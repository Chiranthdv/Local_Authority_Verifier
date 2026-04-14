const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const WorkerProfile = require("../models/WorkerProfile");
const { loginIpLimiter } = require("../middleware/rateLimiters");

const PUBLIC_REGISTRATION_ROLES = new Set(["customer", "worker"]);
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILED_LOGIN_ATTEMPTS = Number.parseInt(process.env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS, 10) || 5;
const ACCOUNT_LOCK_MINUTES = Number.parseInt(process.env.AUTH_ACCOUNT_LOCK_MINUTES, 10) || 15;

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeName(value) {
  return sanitizeText(value).replace(/\s+/g, " ");
}

function sanitizeEmail(value) {
  return sanitizeText(value).toLowerCase();
}

function sanitizeRole(value) {
  return sanitizeText(value).toLowerCase();
}

function extractPassword(value) {
  return typeof value === "string" ? value : "";
}

function getLockDurationMs() {
  return ACCOUNT_LOCK_MINUTES * 60 * 1000;
}

function isAccountLocked(user) {
  if (!user?.lockUntil) {
    return false;
  }
  return new Date(user.lockUntil).getTime() > Date.now();
}

async function registerFailedLogin(user) {
  if (!user) return;

  const attempts = Number(user.failedLoginAttempts || 0) + 1;
  user.failedLoginAttempts = attempts;

  if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    user.lockUntil = new Date(Date.now() + getLockDurationMs());
    user.failedLoginAttempts = 0;
  }

  await user.save({ validateBeforeSave: false });
}

async function clearLoginFailureState(user) {
  if (!user) return;

  const hasState = Number(user.failedLoginAttempts || 0) > 0 || Boolean(user.lockUntil);
  if (!hasState) return;

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save({ validateBeforeSave: false });
}

router.post("/register", async (req, res) => {
  try {
    const name = sanitizeName(req.body?.name);
    const email = sanitizeEmail(req.body?.email);
    const password = extractPassword(req.body?.password);
    const role = sanitizeRole(req.body?.role);

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    if (!PUBLIC_REGISTRATION_ROLES.has(role)) {
      return res.status(403).json({ error: "Public registration is allowed only for customer or worker roles" });
    }

    const user = new User({ name, email, password, role });
    await user.save();

    res.status(201).json({
      message: "User registered",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already registered" });
    }

    res.status(500).json({ error: "Could not register user" });
  }
});

router.post("/login", loginIpLimiter, async (req, res) => {
  try {
    const email = sanitizeEmail(req.body?.email);
    const password = extractPassword(req.body?.password);

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "JWT_SECRET is missing in backend/.env" });
    }

    const user = await User.findOne({ email, isDeleted: false }).select("+password +failedLoginAttempts +lockUntil");

    if (user && isAccountLocked(user)) {
      const retryAfterSeconds = Math.max(1, Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(423).json({
        error: "Account temporarily locked due to repeated failed logins. Try again later.",
        retryAfterSeconds
      });
    }

    const isValidPassword = user ? await user.comparePassword(password) : false;
    if (!user || !isValidPassword) {
      await registerFailedLogin(user);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    await clearLoginFailureState(user);

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const workerProfile = user.role === "worker"
      ? await WorkerProfile.findOne({ userId: user._id }).select("_id")
      : null;

    res.json({
      token,
      role: user.role,
      name: user.name,
      hasProfile: Boolean(workerProfile),
      workerProfileId: workerProfile?._id ?? null
    });
  } catch (err) {
    res.status(500).json({ error: "Could not login" });
  }
});

router.post("/logout", (req, res) => {
  res.json({ message: "Logged out" });
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.user.userId, isDeleted: false }).select("_id name email role");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Could not load profile" });
  }
});

module.exports = router;
