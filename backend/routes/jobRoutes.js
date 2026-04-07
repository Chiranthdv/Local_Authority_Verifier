const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Job = require("../models/Job");
const WorkerProfile = require("../models/WorkerProfile");

// Create job request (customer)
router.post("/create", async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    res.json(job);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Worker accepts job
router.patch("/accept/:id", async (req, res) => {
 const id = req.params.id;

  // ✅ check valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ msg: "Invalid Job ID" });
  }

  const job = await Job.findByIdAndUpdate(
    id,
    { status: "accepted" },
    { new: true }
  );

  if (!job) {
    return res.status(404).json({ msg: "Job not found" });
  }

  res.json(job);
});

// Mark job completed
router.patch("/complete/:id", async (req, res) => {
  const job = await Job.findByIdAndUpdate(
    req.params.id,
    { status: "completed" },
    { new: true }
  );

  // increase trust score
  const worker = await WorkerProfile.findOne({ userId: job.workerId });

  if (worker) {
    worker.trustScore += 10;
    await worker.save();
  }

  res.json(job);
});

module.exports = router;
