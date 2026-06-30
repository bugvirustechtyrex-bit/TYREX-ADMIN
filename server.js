const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "tyrex_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URL,
    }),
  })
);

// Database
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("✅ MongoDB Connected");
    createDefaultAdmin();
  })
  .catch((err) => console.error("❌ DB Error:", err));

// User Model
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" },
  paid: { type: Boolean, default: false },
});

const User = mongoose.model("User", UserSchema);

// Payment Model
const PaymentSchema = new mongoose.Schema({
  user: { type: String, required: true },
  amount: { type: Number, default: 2000 },
  status: { type: String, default: "pending" },
  date: { type: Date, default: Date.now },
});

const Payment = mongoose.model("Payment", PaymentSchema);

// Create Admin
async function createDefaultAdmin() {
  try {
    const adminExists = await User.findOne({ role: "admin" });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = new User({
        username: "admin",
        password: hashedPassword,
        role: "admin",
        paid: true,
      });
      await admin.save();
      console.log("✅ Admin created: admin / admin123");
    }

    const tyrexExists = await User.findOne({ username: "tyrex2005" });
    if (!tyrexExists) {
      const hashedPassword = await bcrypt.hash("2005", 10);
      const user = new User({
        username: "tyrex2005",
        password: hashedPassword,
        role: "admin",
        paid: true,
      });
      await user.save();
      console.log("✅ User created: tyrex2005 / 2005");
    }
  } catch (error) {
    console.error("Error creating admin:", error);
  }
}

// Auth Middleware
function auth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login.html");
}

function admin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  res.redirect("/login.html");
}

// Routes

// Login
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.json({ success: false, message: "Wrong password" });
    }

    req.session.user = user;

    if (user.role === "admin") {
      return res.json({ success: true, redirect: "/admin.html" });
    }

    if (!user.paid) {
      return res.json({ success: true, redirect: "/payment.html" });
    }

    res.json({ success: true, redirect: "/dashboard.html" });
  } catch (err) {
    res.json({ success: false, message: "Server error" });
  }
});

// Add User
app.post("/add-user", async (req, res) => {
  try {
    const { username, password } = req.body;
    const existing = await User.findOne({ username });
    if (existing) {
      return res.json({ success: false, message: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hash, role: "user", paid: false });
    await user.save();

    res.json({ success: true, message: "User created" });
  } catch (err) {
    res.json({ success: false, message: "Server error" });
  }
});

// Payment Request
app.post("/pay-request", async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ success: false, msg: "Please login" });
    }

    const existing = await Payment.findOne({ user: user.username, status: "pending" });
    if (existing) {
      return res.json({ success: true, msg: "Payment already pending" });
    }

    await Payment.create({ user: user.username, amount: 2000, status: "pending" });
    res.json({ success: true, msg: "Payment request sent" });
  } catch (err) {
    res.json({ success: false, msg: "Server error" });
  }
});

// Get Payments (admin only)
app.get("/payments", admin, async (req, res) => {
  try {
    const payments = await Payment.find().sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    res.json([]);
  }
});

// Approve Payment (admin only)
app.post("/approve", admin, async (req, res) => {
  try {
    const { id } = req.body;
    const payment = await Payment.findById(id);
    if (!payment) {
      return res.json({ success: false, message: "Payment not found" });
    }

    payment.status = "approved";
    await payment.save();

    await User.updateOne({ username: payment.user }, { paid: true });

    res.json({ success: true, message: "Payment approved" });
  } catch (err) {
    res.json({ success: false, message: "Server error" });
  }
});

// Pages
app.get("/dashboard", auth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/admin", admin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/payment", auth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "payment.html"));
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login.html"));
});

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
