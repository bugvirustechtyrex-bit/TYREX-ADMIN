const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "tyrex_ksh_secret_2025",
    resave: false,
    saveUninitialized: true,
  })
);

// Static files
app.use(express.static(path.join(__dirname, "public")));

// =====================
// USERS FUNCTIONS
// =====================
function getUsers() {
  const data = fs.readFileSync("users.json");
  return JSON.parse(data);
}

function saveUsers(users) {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

// =====================
// LOGIN
// =====================
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    req.session.user = user;
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Invalid username or password" });
  }
});

// =====================
// SESSION CHECK
// =====================
function isLoggedIn(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login.html");
  }
}

// =====================
// DASHBOARD ROUTE
// =====================
app.get("/dashboard", isLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

// =====================
// GET USER INFO
// =====================
app.get("/me", (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.json(null);
  }
});

// =====================
// LOGOUT
// =====================
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// =====================
// ADD USER (SIMPLE ADMIN FUNCTION)
// =====================
app.post("/add-user", (req, res) => {
  const { username, password } = req.body;

  let users = getUsers();

  const exists = users.find((u) => u.username === username);

  if (exists) {
    return res.json({ success: false, message: "User already exists" });
  }

  users.push({ username, password });

  saveUsers(users);

  res.json({ success: true, message: "User added successfully" });
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log(`TYREX_KSH MD running on http://localhost:${PORT}`);
});
