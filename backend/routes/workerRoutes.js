const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const router = express.Router();
const WorkerProfile = require("../models/WorkerProfile");
const Review = require("../models/Review");
const Document = require("../models/Document");
const calculateTrustScore = require("../utils/trustScore");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const upload = require("../config/multer");
const { buildSignedDocumentUrl } = require("../utils/documentAccess");
const { storageService } = require("../services/storageService");

function getBadgeLevel(score) {
  if (score <= 30) return "Rising";
  if (score <= 60) return "Trusted";
  if (score <= 85) return "Expert";
  return "Elite";
}

function getAverageRating(reviews) {
  if (!reviews.length) return null;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Number((total / reviews.length).toFixed(1));
}

function hasLinkedUser(worker) {
  return Boolean(
    worker &&
    worker.isDeleted !== true &&
    worker?.userId &&
    worker.userId._id &&
    typeof worker.userId.name === "string" &&
    worker.userId.name.trim()
  );
}

function createWorkerRef() {
  return crypto.randomBytes(16).toString("hex");
}

async function ensurePublicRef(worker) {
  if (worker?.publicRef) {
    return worker.publicRef;
  }

  worker.publicRef = createWorkerRef();
  await worker.save();
  return worker.publicRef;
}

function parseAge(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 18 || parsed > 80) return null;
  return Math.round(parsed);
}

function parseNonNegativeNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSkills(skills) {
  if (!Array.isArray(skills)) {
    return [];
  }
  return skills
    .map((skill) => sanitizeText(skill))
    .filter(Boolean);
}

function validateProfilePayload(body) {
  const requiredChecks = [
    { key: "category", valid: Boolean(sanitizeText(body?.category)) },
    { key: "location", valid: Boolean(sanitizeText(body?.location || body?.area)) },
    { key: "phone", valid: Boolean(sanitizeText(body?.phone)) }
  ];

  const age = parseAge(body?.age);
  const experience = parseNonNegativeNumber(body?.experience);
  const hourlyRate = parseNonNegativeNumber(body?.hourlyRate);

  if (age === undefined) {
    return { valid: false, error: "Missing required fields: age" };
  }

  if (experience === undefined) {
    return { valid: false, error: "Missing required fields: experience" };
  }

  if (age === null) {
    return { valid: false, error: "Age must be between 18 and 80" };
  }

  if (experience === null) {
    return { valid: false, error: "Experience must be a non-negative number" };
  }

  if (hourlyRate === null) {
    return { valid: false, error: "Hourly rate must be a non-negative number" };
  }

  const missingFields = requiredChecks.filter((field) => !field.valid).map((field) => field.key);
  if (missingFields.length > 0) {
    return { valid: false, error: `Missing required fields: ${missingFields.join(", ")}` };
  }

  const category = sanitizeText(body?.category).toLowerCase();
  if (!ALLOWED_CATEGORIES.has(category)) {
    return { valid: false, error: "Invalid category" };
  }

  return {
    valid: true,
    payload: {
      age,
      category,
      experience: experience ?? 0,
      hourlyRate: hourlyRate ?? 0,
      location: sanitizeText(body?.location || body?.area),
      phone: sanitizeText(body?.phone),
      bio: sanitizeText(body?.bio),
      skills: normalizeSkills(body?.skills)
    }
  };
}

async function createOrUpdateOwnProfile(req, res) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "Unauthorized: userId missing in token" });
    }

    console.log("[WORKER PROFILE] createOrUpdateOwnProfile called", {
      userId: req.user.userId,
      role: req.user.role,
      body: req.body
    });

    const validation = validateProfilePayload(req.body);
    if (!validation.valid) {
      console.log("[WORKER PROFILE] Validation failed", {
        userId: req.user.userId,
        error: validation.error
      });
      return res.status(400).json({ error: validation.error, message: validation.error });
    }

    // Upsert prevents duplicate-profile races and revives soft-deleted profiles.
    const profile = await WorkerProfile.findOneAndUpdate(
      { userId: req.user.userId },
      {
        $set: {
          ...validation.payload,
          verificationStatus: "pending",
          rejectionReason: "",
          isDeleted: false,
          deletedAt: null
        },
        $setOnInsert: {
          userId: req.user.userId,
          trustScore: 0
        }
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    console.log("[WORKER PROFILE] Upsert success", {
      userId: req.user.userId,
      profileId: String(profile?._id || "")
    });

    return res.status(201).json(profile);
  } catch (error) {
    if (error?.name === "ValidationError") {
      const message = Object.values(error.errors || {})[0]?.message || "Invalid profile data";
      console.error("[WORKER PROFILE] ValidationError during save", {
        userId: req.user?.userId,
        message
      });
      return res.status(400).json({ error: message, message });
    }

    console.error("[WORKER PROFILE] createOrUpdateOwnProfile failed", {
      userId: req.user?.userId,
      message: error.message,
      code: error.code
    });
    return res.status(500).json({ error: "Could not create worker profile", message: "Could not create worker profile" });
  }
}

function normalizeSearchText(value) {
  return sanitizeText(value).toLowerCase();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPublicWorkerDTO(worker, averageRating) {
  return {
    workerRef: worker.publicRef,
    name: worker.userId?.name || "Worker",
    category: worker.category || "",
    rating: averageRating,
    experience: worker.experience || 0,
    area: worker.location || ""
  };
}

function toPrivateWorkerDTO({ worker, averageRating, reviewCount, reviews = [], certificates = [], includeContact = false, includeEmail = false }) {
  return {
    workerRef: worker.publicRef,
    name: worker.userId?.name || "Worker",
    email: includeEmail ? (worker.userId?.email || "") : undefined,
    workerUserId: String(worker.userId?._id || ""),
    category: worker.category || "",
    area: worker.location || "",
    experience: worker.experience || 0,
    rating: averageRating,
    reviewCount,
    verificationStatus: worker.verificationStatus,
    badgeLevel: getBadgeLevel(worker.trustScore),
    bio: worker.bio || "",
    hourlyRate: worker.hourlyRate || 0,
    photoUrl: worker.photoUrl || "",
    phone: includeContact ? (worker.phone || "") : "",
    reviews,
    certificates
  };
}

function toAdminDocumentDTO(req, doc) {
  const plain = doc.toObject ? doc.toObject() : doc;
  return {
    _id: plain._id,
    userId: plain.userId,
    documentType: plain.documentType,
    originalName: plain.originalName,
    mimeType: plain.mimeType,
    fileSize: plain.fileSize,
    status: plain.status,
    reviewNote: plain.reviewNote,
    reviewedBy: plain.reviewedBy,
    reviewedAt: plain.reviewedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    downloadUrl: buildSignedDocumentUrl(req, plain._id, {
      scope: "admin_access",
      actorUserId: req.user.userId
    })
  };
}

const ALLOWED_CATEGORIES = new Set([
  "plumber",
  "electrician",
  "carpenter",
  "cleaner",
  "painter",
  "mechanic",
  "gardener"
]);

router.get("/pending", auth, role("admin"), async (req, res) => {
  try {
    const workers = await WorkerProfile.find({ verificationStatus: "pending", isDeleted: false })
      .populate({ path: "userId", select: "name email", match: { isDeleted: false } })
      .sort({ createdAt: -1 });

    const validWorkers = workers.filter(hasLinkedUser);
    const userIds = validWorkers.map((worker) => worker.userId?._id).filter(Boolean);
    const docs = await Document.find({ userId: { $in: userIds } }).select("userId status");
    const docSummary = docs.reduce((acc, doc) => {
      const key = String(doc.userId);
      if (!acc[key]) {
        acc[key] = { total: 0, pending: 0, approved: 0, rejected: 0 };
      }
      acc[key].total += 1;
      if (doc.status === "pending") acc[key].pending += 1;
      if (doc.status === "approved") acc[key].approved += 1;
      if (doc.status === "rejected") acc[key].rejected += 1;
      return acc;
    }, {});

    res.json(validWorkers.map((worker) => ({
      ...worker.toObject(),
      badgeLevel: getBadgeLevel(worker.trustScore),
      documentSummary: docSummary[String(worker.userId._id)] || { total: 0, pending: 0, approved: 0, rejected: 0 }
    })));
  } catch (err) {
    res.status(500).json({ error: "Could not load pending workers" });
  }
});

router.get("/applications/:id", auth, role("admin"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid worker id" });
    }

    const worker = await WorkerProfile.findOne({ _id: req.params.id, isDeleted: false })
      .populate({ path: "userId", select: "name email", match: { isDeleted: false } });
    if (!worker || !hasLinkedUser(worker)) {
      return res.status(404).json({ error: "Worker not found" });
    }

    const documents = await Document.find({ userId: worker.userId._id }).sort({ createdAt: -1 });
    res.json({
      ...worker.toObject(),
      badgeLevel: getBadgeLevel(worker.trustScore),
      documents: documents.map((doc) => toAdminDocumentDTO(req, doc))
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load worker application" });
  }
});

router.get("/me/profile", auth, role("worker"), async (req, res) => {
  try {
    const worker = await WorkerProfile.findOne({ userId: req.user.userId, isDeleted: false })
      .populate({ path: "userId", select: "name email", match: { isDeleted: false } });

    if (!worker || !hasLinkedUser(worker)) {
      return res.status(404).json({ error: "Worker profile not found" });
    }

    const reviews = await Review.find({ workerId: req.user.userId })
      .populate("customerId", "name")
      .sort({ createdAt: -1 });

    res.json({
      ...worker.toObject(),
      reviews,
      averageRating: getAverageRating(reviews),
      reviewCount: reviews.length,
      badgeLevel: getBadgeLevel(worker.trustScore)
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load worker profile" });
  }
});

async function getPublicWorkers(req, res) {
  try {
    const categoryFilter = normalizeSearchText(req.query.category);
    const locationFilter = normalizeSearchText(req.query.location);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 24, 1), 50);
    const skip = (page - 1) * limit;
    const query = { verificationStatus: "approved", isDeleted: { $ne: true } };

    if (categoryFilter) {
      if (!ALLOWED_CATEGORIES.has(categoryFilter)) {
        return res.status(400).json({ error: "Invalid category filter" });
      }
      query.category = categoryFilter;
    }

    if (locationFilter) {
      query.searchLocation = { $regex: `^${escapeRegex(locationFilter)}` };
    }

    let workers = await WorkerProfile.find(query)
      .populate({ path: "userId", select: "name", match: { isDeleted: false } })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    if (locationFilter && workers.length === 0) {
      const fallbackQuery = { ...query };
      delete fallbackQuery.searchLocation;
      fallbackQuery.location = { $regex: `^${escapeRegex(locationFilter)}`, $options: "i" };
      workers = await WorkerProfile.find(fallbackQuery)
        .populate({ path: "userId", select: "name", match: { isDeleted: false } })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
    }

    const validWorkers = workers.filter(hasLinkedUser);
    const workerIds = validWorkers.map((worker) => worker.userId?._id).filter(Boolean);
    const reviews = await Review.find({ workerId: { $in: workerIds } });
    const reviewsByWorker = reviews.reduce((acc, review) => {
      const key = String(review.workerId);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(review);
      return acc;
    }, {});

    for (const worker of validWorkers) {
      await ensurePublicRef(worker);
    }

    res.json(validWorkers.map((worker) => {
      const workerReviews = reviewsByWorker[String(worker.userId?._id)] || [];
      return toPublicWorkerDTO(worker, getAverageRating(workerReviews));
    }));
  } catch (err) {
    res.status(500).json({ error: "Could not load workers" });
  }
}

router.get("/", getPublicWorkers);
router.get("/search", getPublicWorkers);

router.get("/public/:workerRef", async (req, res) => {
  try {
    const workerRef = sanitizeText(req.params.workerRef);
    if (!workerRef) {
      return res.status(400).json({ error: "Invalid worker reference" });
    }

    const worker = await WorkerProfile.findOne({
      publicRef: workerRef,
      verificationStatus: "approved",
      isDeleted: { $ne: true }
    }).populate({ path: "userId", select: "name", match: { isDeleted: false } });

    if (!worker || !hasLinkedUser(worker)) {
      return res.status(404).json({ error: "Worker not found" });
    }

    await ensurePublicRef(worker);
    const [summary] = await Review.aggregate([
      { $match: { workerId: new mongoose.Types.ObjectId(worker.userId._id) } },
      {
        $group: {
          _id: "$workerId",
          averageRating: { $avg: "$rating" }
        }
      }
    ]);

    res.json(toPublicWorkerDTO(worker, summary ? Number(summary.averageRating.toFixed(1)) : null));
  } catch (err) {
    res.status(500).json({ error: "Could not load worker profile" });
  }
});

router.get("/private/:workerRef", auth, role("customer", "admin", "worker"), async (req, res) => {
  try {
    const workerRef = sanitizeText(req.params.workerRef);
    if (!workerRef) {
      return res.status(400).json({ error: "Invalid worker reference" });
    }

    const worker = await WorkerProfile.findOne({
      publicRef: workerRef,
      verificationStatus: "approved",
      isDeleted: { $ne: true }
    }).populate({ path: "userId", select: "name email", match: { isDeleted: false } });

    if (!worker || !hasLinkedUser(worker)) {
      return res.status(404).json({ error: "Worker not found" });
    }

    await ensurePublicRef(worker);

    const reviews = await Review.find({ workerId: worker.userId._id })
      .populate("customerId", "name")
      .sort({ createdAt: -1 });

    const certificates = await Document.find({
      userId: worker.userId._id,
      documentType: "certificate",
      status: "approved"
    }).select("_id originalName reviewedAt createdAt");

    const safeCertificates = certificates.map((doc) => ({
      _id: doc._id,
      originalName: doc.originalName,
      reviewedAt: doc.reviewedAt,
      createdAt: doc.createdAt,
      downloadUrl: buildSignedDocumentUrl(req, doc._id, {
        scope: "public_certificate"
      })
    }));

    const includeContact = req.user.role === "customer" || req.user.role === "admin";
    const includeEmail = req.user.role === "admin";

    return res.json(toPrivateWorkerDTO({
      worker,
      averageRating: getAverageRating(reviews),
      reviewCount: reviews.length,
      reviews,
      certificates: safeCertificates,
      includeContact,
      includeEmail
    }));
  } catch (err) {
    return res.status(500).json({ error: "Could not load worker profile" });
  }
});

router.get("/:id", auth, role("customer", "admin", "worker"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid worker id" });
    }

    const worker = await WorkerProfile.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .populate({ path: "userId", select: "name email", match: { isDeleted: false } });

    if (!worker || !hasLinkedUser(worker) || worker.verificationStatus !== "approved") {
      return res.status(404).json({ error: "Worker not found" });
    }

    await ensurePublicRef(worker);

    const reviews = await Review.find({ workerId: worker.userId._id })
      .populate("customerId", "name")
      .sort({ createdAt: -1 });
    const certificates = await Document.find({
      userId: worker.userId._id,
      documentType: "certificate",
      status: "approved"
    }).select("_id originalName reviewedAt createdAt");

    return res.json(toPrivateWorkerDTO({
      worker,
      averageRating: getAverageRating(reviews),
      reviewCount: reviews.length,
      reviews,
      certificates: certificates.map((doc) => ({
        _id: doc._id,
        originalName: doc.originalName,
        reviewedAt: doc.reviewedAt,
        createdAt: doc.createdAt,
        downloadUrl: buildSignedDocumentUrl(req, doc._id, {
          scope: "public_certificate"
        })
      })),
      includeContact: req.user.role === "customer" || req.user.role === "admin",
      includeEmail: req.user.role === "admin"
    }));
  } catch (err) {
    return res.status(500).json({ error: "Could not load worker profile" });
  }
});

router.post("/", auth, role("worker"), createOrUpdateOwnProfile);
router.post("/profile", auth, role("worker"), createOrUpdateOwnProfile);

router.patch("/:id", auth, role("worker"), async (req, res) => {
  try {
    const worker = await WorkerProfile.findOne({ _id: req.params.id, isDeleted: false });

    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    if (String(worker.userId) !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const age = parseAge(req.body.age);
    if (age === null) {
      return res.status(400).json({ error: "Age must be between 18 and 80" });
    }

    const fields = ["bio", "skills", "hourlyRate", "location", "phone", "category", "experience"];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        worker[field] = req.body[field];
      }
    }

    if (req.body.area !== undefined && req.body.location === undefined) {
      worker.location = req.body.area;
    }

    if (age !== undefined) {
      worker.age = age;
    }

    if (worker.verificationStatus === "rejected") {
      worker.verificationStatus = "pending";
      worker.rejectionReason = "";
    }

    await worker.save();
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: "Could not update worker profile" });
  }
});

router.post("/:id/photo", auth, role("worker"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Photo file is required" });
    }

    const worker = await WorkerProfile.findOne({ _id: req.params.id, isDeleted: false });

    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    if (String(worker.userId) !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const storedPhoto = await storageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "worker-photos"
    );

    worker.photoUrl = storedPhoto.url;
    await worker.save();

    res.json({ message: "Photo uploaded", photoUrl: worker.photoUrl });
  } catch (err) {
    res.status(500).json({ error: "Could not upload photo" });
  }
});

router.patch("/:id/approve", auth, role("admin"), async (req, res) => {
  try {
    console.log("[WORKER APPROVE] Incoming request", {
      workerProfileId: req.params.id,
      adminUserId: req.user?.userId
    });

    const worker = await WorkerProfile.findOne({ _id: req.params.id, isDeleted: false });

    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    const docs = await Document.find({ userId: worker.userId });
    const hasCertificate = docs.some((doc) => doc.documentType === "certificate");
    const hasRejectedDoc = docs.some((doc) => doc.status === "rejected");
    const hasPendingDoc = docs.some((doc) => doc.status === "pending");

    if (!hasCertificate) {
      return res.status(400).json({ error: "Worker must upload at least one certificate before approval" });
    }

    if (hasRejectedDoc || hasPendingDoc) {
      return res.status(400).json({ error: "Approve all documents first before approving worker" });
    }

    worker.verificationStatus = "approved";
    worker.rejectionReason = "";
    worker.verifiedBy = req.user.userId;
    worker.verifiedAt = new Date();

    try {
      const trustScore = await calculateTrustScore(worker.userId);
      worker.trustScore = Number.isFinite(trustScore) ? trustScore : 0;
    } catch (trustError) {
      console.error("[WORKER APPROVE] Trust score calculation failed", {
        workerProfileId: req.params.id,
        workerUserId: String(worker.userId),
        message: trustError.message
      });
      // Trust score should not block the approval flow.
      worker.trustScore = Number.isFinite(worker.trustScore) ? worker.trustScore : 0;
    }

    await worker.save();

    console.log("[WORKER APPROVE] Success", {
      workerProfileId: req.params.id,
      workerUserId: String(worker.userId),
      trustScore: worker.trustScore
    });

    res.json({ ...worker.toObject(), badgeLevel: getBadgeLevel(worker.trustScore) });
  } catch (err) {
    console.error("[WORKER APPROVE] Failed", {
      workerProfileId: req.params.id,
      message: err.message,
      code: err.code
    });
    res.status(500).json({ error: "Could not approve worker", message: err.message || "Could not approve worker" });
  }
});

router.patch("/:id/reject", auth, role("admin"), async (req, res) => {
  try {
    const reason = sanitizeText(req.body.reason);

    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const worker = await WorkerProfile.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      {
        verificationStatus: "rejected",
        rejectionReason: reason,
        verifiedBy: req.user.userId,
        verifiedAt: new Date()
      },
      { returnDocument: "after" }
    );

    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    res.json({ ...worker.toObject(), badgeLevel: getBadgeLevel(worker.trustScore) });
  } catch (err) {
    res.status(500).json({ error: "Could not reject worker" });
  }
});

module.exports = router;
