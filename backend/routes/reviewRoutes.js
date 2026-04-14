const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Review = require("../models/Review");
const WorkerProfile = require("../models/WorkerProfile");
const Job = require("../models/Job");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const { createActionCooldownMiddleware } = require("../middleware/actionCooldown");
const { reviewIpLimiter, reviewUserLimiter } = require("../middleware/rateLimiters");
const calculateTrustScore = require("../utils/trustScore");
const {
  parsePositiveInt,
  decodeCursor,
  encodeCursor,
  buildDescendingCursorFilter
} = require("../utils/cursorPagination");

const REVIEW_COOLDOWN_MS = Number.parseInt(process.env.COOLDOWN_REVIEW_MS, 10) || 8000;
const DEFAULT_REVIEW_LIMIT = 20;
const MAX_REVIEW_LIMIT = 50;
const reviewCooldown = createActionCooldownMiddleware({
  cooldownMs: REVIEW_COOLDOWN_MS,
  keyGenerator: (req) => {
    const userId = req.user?.userId;
    if (!userId) return "";
    return `review:${userId}`;
  },
  message: "Please wait before submitting another review."
});

router.post("/", auth, role("customer"), reviewIpLimiter, reviewUserLimiter, reviewCooldown, async (req, res) => {
  try {
    const { jobId, workerId, rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: "Invalid job id" });
    }

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
    }

    const job = await Job.findById(jobId).select("_id workerId customerId status isArchived");
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (String(job.customerId) !== req.user.userId) {
      return res.status(403).json({ error: "You can review only your own jobs" });
    }

    if (job.status !== "completed") {
      return res.status(400).json({ error: "Review can be submitted only after job completion" });
    }

    if (job.isArchived) {
      return res.status(400).json({ error: "Archived jobs cannot be reviewed" });
    }

    if (workerId && String(job.workerId) !== String(workerId)) {
      return res.status(400).json({ error: "Worker does not match this job" });
    }

    const existingReview = await Review.findOne({ jobId: job._id, customerId: req.user.userId }).select("_id");
    if (existingReview) {
      return res.status(409).json({ error: "Review already submitted for this completed job" });
    }

    const cleanComment = typeof comment === "string" ? comment.trim() : "";
    if (cleanComment.length > 1000) {
      return res.status(400).json({ error: "Comment must be at most 1000 characters" });
    }

    const review = await Review.create({
      jobId: job._id,
      workerId: job.workerId,
      customerId: req.user.userId,
      rating: parsedRating,
      comment: cleanComment
    });

    const workerProfile = await WorkerProfile.findOne({ userId: job.workerId, isDeleted: false });

    if (workerProfile) {
      workerProfile.trustScore = await calculateTrustScore(job.workerId);
      await workerProfile.save();
    }

    const populatedReview = await Review.findById(review._id).populate("customerId", "name");
    res.status(201).json(populatedReview);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Review already submitted for this completed job" });
    }
    res.status(500).json({ error: "Could not submit review" });
  }
});

router.get("/worker/:workerId", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.workerId)) {
      return res.status(400).json({ error: "Invalid worker id" });
    }
    const limit = parsePositiveInt(req.query.limit, DEFAULT_REVIEW_LIMIT, MAX_REVIEW_LIMIT);
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    if (req.query.cursor && !cursor) {
      return res.status(400).json({ error: "Invalid cursor" });
    }

    const workerProfile = await WorkerProfile.findOne({ userId: req.params.workerId, isDeleted: false }).select("_id");
    if (!workerProfile) {
      return res.status(404).json({ error: "Worker not found" });
    }

    const query = {
      workerId: req.params.workerId,
      ...buildDescendingCursorFilter(cursor, "createdAt", "_id")
    };

    const rows = await Review.find(query)
      .select("_id workerId customerId rating comment createdAt updatedAt")
      .populate({ path: "customerId", select: "name", match: { isDeleted: false } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const reviews = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeCursor(reviews[reviews.length - 1]) : null;

    res.json({
      items: reviews,
      reviews,
      nextCursor,
      hasMore,
      limit
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load reviews" });
  }
});

router.get("/worker/:workerId/summary", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.workerId)) {
      return res.status(400).json({ error: "Invalid worker id" });
    }

    const workerProfile = await WorkerProfile.findOne({ userId: req.params.workerId, isDeleted: false }).select("_id");
    if (!workerProfile) {
      return res.status(404).json({ error: "Worker not found" });
    }

    const [summary] = await Review.aggregate([
      { $match: { workerId: new mongoose.Types.ObjectId(req.params.workerId) } },
      {
        $group: {
          _id: "$workerId",
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          fiveStarCount: {
            $sum: {
              $cond: [{ $eq: ["$rating", 5] }, 1, 0]
            }
          }
        }
      }
    ]);

    if (!summary) {
      return res.json({ averageRating: null, totalReviews: 0, fiveStarCount: 0 });
    }

    res.json({
      averageRating: Number(summary.averageRating.toFixed(1)),
      totalReviews: summary.totalReviews,
      fiveStarCount: summary.fiveStarCount
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load rating summary" });
  }
});

module.exports = router;
