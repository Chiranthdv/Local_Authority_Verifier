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
    console.log("[REGISTER] Incoming request body:", {
      name: req.body?.name,
      email: req.body?.email,
      password: req.body?.password ? "***" : undefined,
      role: req.body?.role
    });

    const name = sanitizeName(req.body?.name);
    const email = sanitizeEmail(req.body?.email);
    const password = extractPassword(req.body?.password);
    const role = sanitizeRole(req.body?.role);

    console.log("[REGISTER] After sanitization:", { name, email, role, passwordLength: password.length });

    if (!name || !email || !password || !role) {
      console.log("[REGISTER] Validation failed - missing fields");
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!EMAIL_PATTERN.test(email)) {
      console.log("[REGISTER] Validation failed - invalid email format:", email);
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      console.log("[REGISTER] Validation failed - password too short");
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    if (!PUBLIC_REGISTRATION_ROLES.has(role)) {
      console.log("[REGISTER] Validation failed - invalid role:", role);
      return res.status(403).json({ error: "Public registration is allowed only for customer or worker roles" });
    }

    console.log("[REGISTER] All validations passed, creating user");
    const user = new User({ name, email, password, role });
    await user.save();
    console.log("[REGISTER] User created successfully:", user._id);

    // Auto-create worker profile for workers
    if (role === "worker") {
      try {
        console.log("[REGISTER] Creating worker profile for user:", user._id);
        const workerProfile = new WorkerProfile({
          userId: user._id,
          verificationStatus: "pending",
          rejectionReason: "",
          trustScore: 0
        });
        await workerProfile.save();
        console.log("[REGISTER] Worker profile created successfully:", workerProfile._id);
      } catch (profileError) {
        console.error("[REGISTER] Failed to create worker profile:", profileError);
        // Don't fail registration if profile creation fails
      }
    }

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
    console.error("[REGISTER] Error during registration:", {
      code: err.code,
      message: err.message,
      stack: err.stack
    });

    if (err.code === 11000) {
      console.log("[REGISTER] Duplicate key error - email already exists");
      return res.status(409).json({ error: "Email already registered" });
    }

    // Return more detailed error message
    const errorMessage = err.message || "Could not register user";
    res.status(500).json({ error: errorMessage });
  }
});

router.post("/login", loginIpLimiter, async (req, res) => {
  try {
    console.log("[LOGIN] Incoming request:", { email: req.body?.email });

    const email = sanitizeEmail(req.body?.email);
    const password = extractPassword(req.body?.password);

    if (!email || !password) {
      console.log("[LOGIN] Validation failed - missing email or password");
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!EMAIL_PATTERN.test(email)) {
      console.log("[LOGIN] Validation failed - invalid email format:", email);
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("[LOGIN] CRITICAL: JWT_SECRET is missing");
      return res.status(500).json({ error: "JWT_SECRET is missing in backend/.env" });
    }

    console.log("[LOGIN] Looking up user with email:", email);
    const user = await User.findOne({ email, isDeleted: false }).select("+password +failedLoginAttempts +lockUntil");
    if (user?.role === "admin") {
      console.log("[LOGIN] Admin account attempted regular login route");
      return res.status(403).json({ error: "Use /api/admin/login for admin access" });
    }

    if (user && isAccountLocked(user)) {
      console.log("[LOGIN] User account is locked:", email);
      const retryAfterSeconds = Math.max(1, Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(423).json({
        error: "Account temporarily locked due to repeated failed logins. Try again later.",
        retryAfterSeconds
      });
    }

    const isValidPassword = user ? await user.comparePassword(password) : false;
    if (!user || !isValidPassword) {
      console.log("[LOGIN] Authentication failed - invalid credentials");
      await registerFailedLogin(user);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    console.log("[LOGIN] Password verified, clearing failure state");
    await clearLoginFailureState(user);

    console.log("[LOGIN] Generating JWT token");
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const workerProfile = user.role === "worker"
      ? await WorkerProfile.findOne({ userId: user._id }).select("_id")
      : null;

    console.log("[LOGIN] Login successful for user:", user._id);
    res.json({
      token,
      role: user.role,
      name: user.name,
      hasProfile: Boolean(workerProfile),
      workerProfileId: workerProfile?._id ?? null
    });
  } catch (err) {
    console.error("[LOGIN] Error during login:", {
      message: err.message,
      stack: err.stack
    });
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
