require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const { Server } = require("socket.io");
const pool = require("./db");

const app = express();
const server = http.createServer(app);

const FRONTURL = process.env.FRONTURL || "http://localhost:5173";
const PORT = process.env.PORT || 8000;
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

app.use(cors({ origin: FRONTURL, credentials: true }));
app.use(express.json());

const sessionMiddleware = session({
  store: new PgSession({ pool, tableName: "session" }),
  secret: process.env.SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());


passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const { rows } = await pool.query("SELECT * FROM reg WHERE username = $1", [username]);
      if (rows.length === 0) return done(null, false, { message: "Invalid credentials" });
      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return done(null, false, { message: "Invalid credentials" });
      return done(null, { id: user.id, username: user.username });
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query("SELECT id, username FROM reg WHERE id = $1", [id]);
    if (rows.length === 0) return done(null, false);
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});


app.post("/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO reg (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, hash]
    );
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Username taken" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || "Unauthorized" });
    req.logIn(user, (err) => {
      if (err) return next(err);
      res.json({ ok: true, user });
    });
  })(req, res, next);
});

app.get("/home", (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  res.json({ user: req.user });
});

app.post("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });
});

app.get("/", (_req, res) => res.send("Vcall backend up"));


const io = new Server(server, {
  cors: { origin: FRONTURL, credentials: true },
});

const onlineUsers = {}; 

io.on("connection", (socket) => {
  socket.on("register", (username) => {
    if (!username) return;
    onlineUsers[username] = socket.id;
    socket.data.username = username;
    io.emit("online-users", onlineUsers);
  });

  socket.on("offer", ({ to, offer, from }) => {
    io.to(to).emit("offer", { from, fromSocketId: socket.id, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { candidate });
  });

  socket.on("call-rejected", ({ to }) => {
    io.to(to).emit("call-rejected");
  });

  socket.on("end-call", ({ to }) => {
    io.to(to).emit("end-call");
  });

  socket.on("disconnect", () => {
    const u = socket.data.username;
    if (u && onlineUsers[u] === socket.id) delete onlineUsers[u];
    io.emit("online-users", onlineUsers);
  });
});

server.listen(PORT, () => console.log(`Vcall backend listening on :${PORT}`));
