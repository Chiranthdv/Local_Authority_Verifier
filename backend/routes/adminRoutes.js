const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/User");
const WorkerProfile = require("../models/WorkerProfile");
const Document = require("../models/Document");
const Job = require("../models/Job");
const RefreshToken = require("../models/RefreshToken");
const calculateTrustScore = require("../utils/trustScore");
const { loginIpLimiter } = require("../middleware/rateLimiters");
const auth = require("../middleware/auth");
const role = require("../middleware/role");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";
const REFRESH_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeEmail(value) {
  return sanitizeText(value).toLowerCase();
}

function extractPassword(value) {
  return typeof value === "string" ? value : "";
}

function signAccessToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

function hashRefreshToken(refreshToken) {
  return crypto.createHash("sha256").update(refreshToken).digest("hex");
}

async function createRefreshTokenRecord(userId) {
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS);

  await RefreshToken.create({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt
  });

  return refreshToken;
}

function setAccessTokenCookie(res, token) {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60 * 1000
  });
}

function setRefreshTokenCookie(res, token) {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_LIFETIME_MS
  });
}

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

    const user = await User.findOne({ email, isDeleted: false }).select("+password name role");
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin login is not allowed for this account" });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await createRefreshTokenRecord(user._id);
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    return res.json({
      role: "admin",
      name: user.name
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Could not login as admin" });
  }
});

router.get("/dashboard", auth, role("admin"), async (req, res) => {
  try {
    const [
      totalUsers,
      totalCustomers,
      totalWorkers,
      totalAdmins,
      pendingWorkers,
      approvedWorkers,
      rejectedWorkers,
      pendingDocuments,
      approvedDocuments,
      rejectedDocuments,
      openJobs,
      completedJobs,
      recentPendingWorkers
    ] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      User.countDocuments({ role: "customer", isDeleted: false }),
      User.countDocuments({ role: "worker", isDeleted: false }),
      User.countDocuments({ role: "admin", isDeleted: false }),
      WorkerProfile.countDocuments({ verificationStatus: "pending", isDeleted: false }),
      WorkerProfile.countDocuments({ verificationStatus: "approved", isDeleted: false }),
      WorkerProfile.countDocuments({ verificationStatus: "rejected", isDeleted: false }),
      Document.countDocuments({ status: "pending" }),
      Document.countDocuments({ status: "approved" }),
      Document.countDocuments({ status: "rejected" }),
      Job.countDocuments({ status: { $in: ["pending", "requested", "accepted"] }, isArchived: false }),
      Job.countDocuments({ status: "completed", isArchived: false }),
      WorkerProfile.find({ verificationStatus: "pending", isDeleted: false })
        .populate({ path: "userId", select: "name email role", match: { isDeleted: false } })
        .select("_id category location age experience bio verificationStatus createdAt")
        .sort({ createdAt: -1 })
    ]);

    const pendingUserIds = recentPendingWorkers
      .map((item) => item.userId?._id)
      .filter(Boolean);

    const docSummaryRows = pendingUserIds.length
      ? await Document.aggregate([
        { $match: { userId: { $in: pendingUserIds } } },
        {
          $group: {
            _id: "$userId",
            total: { $sum: 1 },
            pending: {
              $sum: {
                $cond: [{ $eq: ["$status", "pending"] }, 1, 0]
              }
            },
            approved: {
              $sum: {
                $cond: [{ $eq: ["$status", "approved"] }, 1, 0]
              }
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ["$status", "rejected"] }, 1, 0]
              }
            }
          }
        }
      ])
      : [];

    const docSummaryByUserId = docSummaryRows.reduce((acc, item) => {
      acc[String(item._id)] = {
        total: item.total || 0,
        pending: item.pending || 0,
        approved: item.approved || 0,
        rejected: item.rejected || 0
      };
      return acc;
    }, {});

    return res.json({
      stats: {
        users: {
          total: totalUsers,
          customers: totalCustomers,
          workers: totalWorkers,
          admins: totalAdmins
        },
        workerVerification: {
          pending: pendingWorkers,
          approved: approvedWorkers,
          rejected: rejectedWorkers
        },
        documents: {
          pending: pendingDocuments,
          approved: approvedDocuments,
          rejected: rejectedDocuments
        },
        jobs: {
          open: openJobs,
          completed: completedJobs
        }
      },
      pendingApplications: recentPendingWorkers
        .filter((item) => item.userId)
        .map((item) => ({
          _id: item._id,
          workerUserId: item.userId?._id,
          name: item.userId?.name || "Worker",
          email: item.userId?.email || "",
          category: item.category || "",
          location: item.location || "",
          age: item.age ?? null,
          experience: item.experience ?? 0,
          bio: item.bio || "",
          verificationStatus: item.verificationStatus,
          createdAt: item.createdAt,
          documentSummary: docSummaryByUserId[String(item.userId?._id)] || {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0
          }
        }))
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Could not load admin dashboard" });
  }
});

router.put("/approve/:id", auth, role("admin"), async (req, res, next) => {
  try {
    console.log("Approve route hit");
    console.log("[ADMIN APPROVE] next type:", typeof next);
    console.log("[ADMIN APPROVE] Request", {
      workerProfileId: req.params.id,
      adminUserId: req.user?.userId
    });

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid worker id", message: "Invalid worker id" });
    }

    const worker = await WorkerProfile.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!worker) {
      return res.status(404).json({ error: "Worker not found", message: "Worker not found" });
    }

    const docs = await Document.find({ userId: worker.userId });
    const hasCertificate = docs.some((doc) => doc.documentType === "certificate");
    const hasRejectedDoc = docs.some((doc) => doc.status === "rejected");
    const hasPendingDoc = docs.some((doc) => doc.status === "pending");

    if (!hasCertificate) {
      return res.status(400).json({
        error: "Worker must upload at least one certificate before approval",
        message: "Worker must upload at least one certificate before approval"
      });
    }

    if (hasRejectedDoc || hasPendingDoc) {
      return res.status(400).json({
        error: "Approve all documents first before approving worker",
        message: "Approve all documents first before approving worker"
      });
    }

    worker.verificationStatus = "approved";
    worker.rejectionReason = "";
    worker.verifiedBy = req.user.userId;
    worker.verifiedAt = new Date();

    try {
      const trustScore = await calculateTrustScore(worker.userId);
      worker.trustScore = Number.isFinite(trustScore) ? trustScore : 0;
    } catch (trustError) {
      console.error("[ADMIN APPROVE] Trust score calculation failed", {
        workerProfileId: req.params.id,
        workerUserId: String(worker.userId),
        message: trustError.message
      });
      worker.trustScore = Number.isFinite(worker.trustScore) ? worker.trustScore : 0;
    }

    await worker.save();

    console.log("[ADMIN APPROVE] Success", {
      workerProfileId: req.params.id,
      workerUserId: String(worker.userId),
      verificationStatus: worker.verificationStatus,
      trustScore: worker.trustScore
    });

    return res.json({
      message: "Worker approved",
      worker: {
        _id: worker._id,
        userId: worker.userId,
        verificationStatus: worker.verificationStatus,
        trustScore: worker.trustScore,
        verifiedAt: worker.verifiedAt,
        verifiedBy: worker.verifiedBy
      }
    });
  } catch (error) {
    console.error("[ADMIN APPROVE] Failed", {
      workerProfileId: req.params.id,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    if (typeof next === "function") {
      return next(error);
    }
    return res.status(500).json({ error: "Could not approve worker", message: error.message || "Could not approve worker" });
  }
});

module.exports = router;
