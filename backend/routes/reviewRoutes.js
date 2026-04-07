const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Review = require("../models/Review");
const WorkerProfile = require("../models/WorkerProfile");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const calculateTrustScore = require("../utils/trustScore");

router.post("/", auth, role("customer"), async (req, res) => {
  try {
    const { workerId, rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(workerId)) {
      return res.status(400).json({ error: "Invalid worker id" });
    }

    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({ error: "Comment must be at least 10 characters long" });
    }

    const review = await Review.create({
      workerId,
      customerId: req.user.userId,
      rating,
      comment: comment.trim()
    });

    const workerProfile = await WorkerProfile.findOne({ userId: workerId });

    if (workerProfile) {
      workerProfile.trustScore = await calculateTrustScore(workerId);
      await workerProfile.save();
    }

    const populatedReview = await Review.findById(review._id).populate("customerId", "name");
    res.status(201).json(populatedReview);
  } catch (err) {
    res.status(500).json({ error: "Could not submit review" });
  }
});

router.get("/worker/:workerId", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.workerId)) {
      return res.status(400).json({ error: "Invalid worker id" });
    }

    const reviews = await Review.find({ workerId: req.params.workerId })
      .populate("customerId", "name")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Could not load reviews" });
  }
});

module.exports = router;
