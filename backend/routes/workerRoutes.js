const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const WorkerProfile = require("../models/WorkerProfile");
const Review = require("../models/Review");
const calculateTrustScore = require("../utils/trustScore");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const upload = require("../config/multer");

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
    worker?.userId &&
    worker.userId._id &&
    typeof worker.userId.name === "string" &&
    worker.userId.name.trim()
  );
}

router.get("/pending", auth, role("admin"), async (req, res) => {
  try {
    const workers = await WorkerProfile.find({ verificationStatus: "pending" })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    const validWorkers = workers.filter(hasLinkedUser);
    const orphanedIds = workers.filter((worker) => !hasLinkedUser(worker)).map((worker) => worker._id);

    if (orphanedIds.length) {
      await WorkerProfile.deleteMany({ _id: { $in: orphanedIds } });
    }

    res.json(validWorkers.map((worker) => ({
      ...worker.toObject(),
      badgeLevel: getBadgeLevel(worker.trustScore)
    })));
  } catch (err) {
    res.status(500).json({ error: "Could not load pending workers" });
  }
});

router.get("/me/profile", auth, role("worker"), async (req, res) => {
  try {
    const worker = await WorkerProfile.findOne({ userId: req.user.userId })
      .populate("userId", "name email");

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

router.get("/", async (req, res) => {
  try {
    const sortOption = { createdAt: -1 };

    const workers = await WorkerProfile.find({})
      .populate("userId", "name email")
      .sort(sortOption);

    const validWorkers = workers.filter(hasLinkedUser);
    const orphanedIds = workers.filter((worker) => !hasLinkedUser(worker)).map((worker) => worker._id);

    if (orphanedIds.length) {
      await WorkerProfile.deleteMany({ _id: { $in: orphanedIds } });
    }

    const workerIds = validWorkers.map((worker) => worker.userId?._id).filter(Boolean);
    const reviews = await Review.find({ workerId: { $in: workerIds } });
    const reviewsByWorker = reviews.reduce((acc, review) => {
      const key = String(review.workerId);
      acc[key] = acc[key] || [];
      acc[key].push(review);
      return acc;
    }, {});

    res.json(validWorkers.map((worker) => {
      const workerReviews = reviewsByWorker[String(worker.userId?._id)] || [];
      return {
        ...worker.toObject(),
        averageRating: getAverageRating(workerReviews),
        reviewCount: workerReviews.length,
        badgeLevel: getBadgeLevel(worker.trustScore)
      };
    }));
  } catch (err) {
    res.status(500).json({ error: "Could not load workers" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid worker id" });
    }

    const worker = await WorkerProfile.findById(req.params.id)
      .populate("userId", "name email");

    if (!worker || !hasLinkedUser(worker)) {
      if (worker && !hasLinkedUser(worker)) {
        await WorkerProfile.deleteOne({ _id: worker._id });
      }
      return res.status(404).json({ error: "Worker not found" });
    }

    const reviews = await Review.find({ workerId: worker.userId._id })
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

router.post("/", auth, role("worker"), async (req, res) => {
  try {
    const existing = await WorkerProfile.findOne({ userId: req.user.userId });

    if (existing) {
      return res.status(409).json({ error: "Worker profile already exists" });
    }

    const profile = new WorkerProfile({
      userId: req.user.userId,
      bio: req.body.bio,
      skills: Array.isArray(req.body.skills) ? req.body.skills : [],
      hourlyRate: req.body.hourlyRate,
      category: req.body.category,
      location: req.body.location,
      phone: req.body.phone,
      experience: req.body.experience || 0
    });

    await profile.save();
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: "Could not create worker profile" });
  }
});

router.patch("/:id", auth, role("worker"), async (req, res) => {
  try {
    const worker = await WorkerProfile.findById(req.params.id);

    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    if (String(worker.userId) !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const fields = ["bio", "skills", "hourlyRate", "location", "phone", "category", "experience"];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        worker[field] = req.body[field];
      }
    }

    await worker.save();
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: "Could not update worker profile" });
  }
});

router.post("/:id/photo", auth, role("worker"), upload.single("file"), async (req, res) => {
  try {
    const worker = await WorkerProfile.findById(req.params.id);

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
    const worker = await WorkerProfile.findById(req.params.id);

    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    worker.verificationStatus = "approved";
    worker.trustScore = await calculateTrustScore(worker.userId);
    await worker.save();

    res.json({ ...worker.toObject(), badgeLevel: getBadgeLevel(worker.trustScore) });
  } catch (err) {
    res.status(500).json({ error: "Could not approve worker" });
  }
});

router.patch("/:id/reject", auth, role("admin"), async (req, res) => {
  try {
    const worker = await WorkerProfile.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: "rejected" },
      { new: true }
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
