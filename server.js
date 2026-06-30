const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "tyrex_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

// static files
app.use(express.static("public"));

// load users
function getUsers() {
  const data = fs.readFileSync("users.json");
  return JSON.parse(data);
}

// save users
function saveUsers(users) {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

// LOGIN
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    req.session.user = user;
    res.json({ success: true, redirect: "/dashboard.html" });
  } else {
    res.json({ success: false, message: "Invalid username or password" });
  }
});

// CHECK LOGIN
app.get("/me", (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.json(null);
  }
});

// ADMIN ADD USER
app.post("/add-user", (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();

  users.push({ username, password });

  saveUsers(users);

  res.json({ success: true });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`TYREX_KSH MD running on http://localhost:${PORT}`);
});
