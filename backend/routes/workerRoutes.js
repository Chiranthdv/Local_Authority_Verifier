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

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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
    const query = { verificationStatus: "approved", isDeleted: false };

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
      isDeleted: false
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
      isDeleted: false
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

    const worker = await WorkerProfile.findOne({ _id: req.params.id, isDeleted: false })
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

router.post("/", auth, role("worker"), async (req, res) => {
  try {
    const existing = await WorkerProfile.findOne({ userId: req.user.userId, isDeleted: false });

    if (existing) {
      return res.status(409).json({ error: "Worker profile already exists" });
    }

    const age = parseAge(req.body.age);
    if (age === null) {
      return res.status(400).json({ error: "Age must be between 18 and 80" });
    }

    const profile = new WorkerProfile({
      userId: req.user.userId,
      age,
      bio: sanitizeText(req.body.bio),
      skills: Array.isArray(req.body.skills) ? req.body.skills : [],
      hourlyRate: req.body.hourlyRate,
      category: req.body.category,
      location: sanitizeText(req.body.location || req.body.area),
      phone: sanitizeText(req.body.phone),
      experience: req.body.experience || 0,
      verificationStatus: "pending",
      rejectionReason: ""
    });

    await profile.save();
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: "Could not create worker profile" });
  }
});

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

    worker.photoUrl = req.file.path;
    await worker.save();

    res.json({ message: "Photo uploaded", photoUrl: worker.photoUrl });
  } catch (err) {
    res.status(500).json({ error: "Could not upload photo" });
  }
});

router.patch("/:id/approve", auth, role("admin"), async (req, res) => {
  try {
    const worker = await WorkerProfile.findOne({ _id: req.params.id, isDeleted: false });

    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    const docs = await Document.find({ userId: worker.userId });
    const hasCertificate = docs.some((doc) => doc.documentType === "certificate");
    const hasIdProof = docs.some((doc) => doc.documentType === "id_proof");
    const hasRejectedDoc = docs.some((doc) => doc.status === "rejected");
    const hasPendingDoc = docs.some((doc) => doc.status === "pending");

    if (!hasCertificate || !hasIdProof) {
      return res.status(400).json({ error: "Worker must upload certificate and id proof before approval" });
    }

    if (hasRejectedDoc || hasPendingDoc) {
      return res.status(400).json({ error: "Approve all documents first before approving worker" });
    }

    worker.verificationStatus = "approved";
    worker.rejectionReason = "";
    worker.verifiedBy = req.user.userId;
    worker.verifiedAt = new Date();
    worker.trustScore = await calculateTrustScore(worker.userId);
    await worker.save();

    res.json({ ...worker.toObject(), badgeLevel: getBadgeLevel(worker.trustScore) });
  } catch (err) {
    res.status(500).json({ error: "Could not approve worker" });
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
