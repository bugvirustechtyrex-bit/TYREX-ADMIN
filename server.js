require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

app.use(bodyParser.json());
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// CONNECT DB
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

// USER MODEL
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, default: "user" }
});

const User = mongoose.model("User", UserSchema);

// REGISTER USER (ADMIN ONLY LATER)
app.post("/add-user", async (req,res)=>{
  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  const user = new User({
    username,
    password: hash,
    role: "user"
  });

  await user.save();

  res.json({ success:true, message:"User created" });
});

// LOGIN
app.post("/login", async (req,res)=>{
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if(!user){
    return res.json({ success:false, message:"User not found" });
  }

  const match = await bcrypt.compare(password, user.password);

  if(!match){
    return res.json({ success:false, message:"Wrong password" });
  }

  req.session.user = user;

  if(user.role === "admin"){
    res.json({ success:true, redirect:"/admin.html" });
  }else{
    res.json({ success:true, redirect:"/dashboard.html" });
  }
});

// MIDDLEWARE
function auth(req,res,next){
  if(req.session.user) next();
  else res.redirect("/login.html");
}

// ADMIN ONLY
function admin(req,res,next){
  if(req.session.user && req.session.user.role==="admin") next();
  else res.redirect("/login.html");
}

// DASHBOARD
app.get("/dashboard", auth, (req,res)=>{
  res.sendFile(path.join(__dirname,"public/dashboard.html"));
});

// ADMIN
app.get("/admin", admin, (req,res)=>{
  res.sendFile(path.join(__dirname,"public/admin.html"));
});

// LOGOUT
app.get("/logout",(req,res)=>{
  req.session.destroy(()=>{
    res.redirect("/login.html");
  });
});

app.listen(process.env.PORT,()=>{
  console.log("Server running on port "+process.env.PORT);
});
