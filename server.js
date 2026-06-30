require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static("public")); // serves HTML, CSS, JS from /public

app.use(
  session({
    secret: process.env.SESSION_SECRET || "tyrex_ksh_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

// -------------------- DATABASE --------------------
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// -------------------- MODELS --------------------
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" }, // "admin" or "user"
  paid: { type: Boolean, default: false },
});

const User = mongoose.model("User", UserSchema);

const PaymentSchema = new mongoose.Schema({
  user: { type: String, required: true },
  amount: { type: Number, default: 2000 },
  status: { type: String, default: "pending" }, // "pending" or "approved"
  date: { type: Date, default: Date.now },
});

const Payment = mongoose.model("Payment", PaymentSchema);

// -------------------- AUTH MIDDLEWARE --------------------
function auth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login.html");
}

function admin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  res.redirect("/login.html");
}

// -------------------- ROUTES --------------------

// 1. ADD USER (admin only via panel)
app.post("/add-user", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password required" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      password: hash,
      role: "user",
      paid: false,
    });
    await user.save();

    res.json({ success: true, message: "User created successfully" });
  } catch (err) {
    console.error("Add user error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. LOGIN
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.json({ success: false, message: "Please fill in all fields" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.json({ success: false, message: "Wrong password" });
    }

    req.session.user = user;

    // Redirect based on role and payment status
    if (user.role === "admin") {
      return res.json({ success: true, redirect: "/admin.html" });
    }

    if (!user.paid) {
      return res.json({ success: true, redirect: "/payment.html" });
    }

    res.json({ success: true, redirect: "/dashboard.html" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 3. PAYMENT REQUEST
app.post("/pay-request", async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ success: false, msg: "Please login first" });
    }

    // Check if there's already a pending payment for this user
    const existing = await Payment.findOne({ user: user.username, status: "pending" });
    if (existing) {
      return res.json({ success: true, msg: "Payment already pending, please wait for approval" });
    }

    await Payment.create({
      user: user.username,
      amount: 2000,
      status: "pending",
    });

    res.json({ success: true, msg: "Payment request sent! Waiting for admin approval." });
  } catch (err) {
    console.error("Pay-request error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

// 4. GET PAYMENTS (admin only)
app.get("/payments", admin, async (req, res) => {
  try {
    const payments = await Payment.find().sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    console.error("Get payments error:", err);
    res.status(500).json([]);
  }
});

// 5. APPROVE PAYMENT (admin only)
app.post("/approve", admin, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: "Payment ID required" });
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    if (payment.status === "approved") {
      return res.json({ success: true, message: "Already approved" });
    }

    payment.status = "approved";
    await payment.save();

    // Update user's paid status
    await User.updateOne(
      { username: payment.user },
      { paid: true }
    );

    res.json({ success: true, message: "Payment approved" });
  } catch (err) {
    console.error("Approve payment error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 6. DASHBOARD (protected)
app.get("/dashboard", auth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// 7. ADMIN PANEL (admin only)
app.get("/admin", admin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// 8. PAYMENT PAGE (user only)
app.get("/payment", auth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "payment.html"));
});

// 9. LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Logout error:", err);
    res.redirect("/login.html");
  });
});

// 10. ROOT - redirect to login
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 TYREX_KSH MD running on port ${PORT}`);
  console.log(`📁 Visit: http://localhost:${PORT}`);
});
