const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Job = require("../models/Job");
const WorkerProfile = require("../models/WorkerProfile");
const Review = require("../models/Review");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const idempotencyKey = require("../middleware/idempotencyKey");
const { createActionCooldownMiddleware } = require("../middleware/actionCooldown");
const { bookingIpLimiter, bookingUserLimiter } = require("../middleware/rateLimiters");
const calculateTrustScore = require("../utils/trustScore");
const { createNotification } = require("../utils/notifications");

const TIME_SLOTS = {
  SLOT_06_10: { code: "SLOT_06_10", label: "06:00-10:00", startHour: 6, endHour: 10 },
  SLOT_10_14: { code: "SLOT_10_14", label: "10:00-14:00", startHour: 10, endHour: 14 },
  SLOT_14_18: { code: "SLOT_14_18", label: "14:00-18:00", startHour: 14, endHour: 18 },
  SLOT_18_22: { code: "SLOT_18_22", label: "18:00-22:00", startHour: 18, endHour: 22 }
};

const BOOKING_COOLDOWN_MS = Number.parseInt(process.env.COOLDOWN_BOOKING_MS, 10) || 8000;
const bookingCooldown = createActionCooldownMiddleware({
  cooldownMs: BOOKING_COOLDOWN_MS,
  keyGenerator: (req) => {
    const userId = req.user?.userId;
    if (!userId) return "";
    return `booking:${userId}`;
  },
  message: "Please wait before creating another booking request."
});

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeDateOnly(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return utcDate;
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(input) {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}

function getStatusFilter(status) {
  const normalized = normalizeStatus(status);
  if (!normalized) return {};
  if (normalized === "pending") return { status: { $in: ["pending", "requested"] } };
  return { status: normalized };
}

function buildSlotLockKey({ workerId, serviceDate, timeSlotCode }) {
  if (!workerId || !serviceDate || !timeSlotCode) return null;
  return `${workerId}:${formatDateKey(serviceDate)}:${timeSlotCode}`;
}

function getTodayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isPastServiceDate(serviceDate) {
  return serviceDate < getTodayUtcDate();
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

function hasKeyPattern(error, keyName) {
  return Boolean(error?.keyPattern && Object.prototype.hasOwnProperty.call(error.keyPattern, keyName));
}

async function createJobRequest(req, res) {
  try {
    const { workerId, description, address } = req.body;
    const timeSlotCode = normalizeStatus(req.body.timeSlotCode).toUpperCase();
    const slot = TIME_SLOTS[timeSlotCode];
    const serviceDate = normalizeDateOnly(req.body.serviceDate || req.body.date);
    const requestDateKey = serviceDate ? formatDateKey(serviceDate) : "";
    const requestingCustomerId = req.user.userId;
    const requestIdempotencyKey = req.idempotencyKey;

    if (!isValidObjectId(workerId)) {
      return res.status(400).json({ error: "Invalid worker id" });
    }

    if (!serviceDate) {
      return res.status(400).json({ error: "Valid serviceDate is required" });
    }

    if (!slot) {
      return res.status(400).json({ error: "Invalid time slot code" });
    }

    if (isPastServiceDate(serviceDate)) {
      return res.status(400).json({ error: "Bookings for past dates are not allowed" });
    }

    if (requestIdempotencyKey) {
      const existingByIdempotency = await Job.findOne({
        customerId: requestingCustomerId,
        idempotencyKey: requestIdempotencyKey
      });

      if (existingByIdempotency) {
        const samePayload =
          String(existingByIdempotency.workerId) === String(workerId) &&
          formatDateKey(existingByIdempotency.serviceDate) === requestDateKey &&
          String(existingByIdempotency.timeSlotCode) === slot.code;

        if (!samePayload) {
          return res.status(409).json({
            error: "Idempotency-Key already used for a different booking payload"
          });
        }

        return res.status(200).json({
          ...existingByIdempotency.toObject(),
          idempotentReplay: true
        });
      }
    }

    const workerProfile = await WorkerProfile.findOne({
      userId: workerId,
      verificationStatus: "approved",
      isDeleted: false
    }).populate({ path: "userId", select: "name", match: { isDeleted: false } });

    if (!workerProfile || !workerProfile.userId) {
      return res.status(404).json({ error: "Worker not available for booking" });
    }

    const existingAccepted = await Job.findOne({
      workerId,
      serviceDate,
      timeSlotCode: slot.code,
      isArchived: false,
      status: "accepted"
    }).select("_id");

    if (existingAccepted) {
      return res.status(409).json({ error: "Selected worker is already booked for this slot" });
    }

    const existingPendingDuplicate = await Job.findOne({
      customerId: requestingCustomerId,
      workerId,
      serviceDate,
      timeSlotCode: slot.code,
      isArchived: false,
      status: { $in: ["pending", "requested"] }
    }).select("_id");

    if (existingPendingDuplicate) {
      return res.status(409).json({
        error: "Duplicate booking request already exists for this slot",
        existingRequestId: existingPendingDuplicate._id
      });
    }

    const overlappingCustomerBooking = await Job.findOne({
      customerId: requestingCustomerId,
      serviceDate,
      timeSlotCode: slot.code,
      isArchived: false,
      status: { $in: ["pending", "requested", "accepted"] }
    }).select("_id workerId status");

    if (overlappingCustomerBooking) {
      return res.status(409).json({
        error: "Customer already has a booking in this time slot",
        existingRequestId: overlappingCustomerBooking._id
      });
    }

    const job = await Job.create({
      customerId: requestingCustomerId,
      workerId,
      workerProfileId: workerProfile._id,
      description: typeof description === "string" ? description.trim() : "",
      address: typeof address === "string" ? address.trim() : "",
      serviceDate,
      timeSlotCode: slot.code,
      timeSlotLabel: slot.label,
      scheduledTime: serviceDate,
      idempotencyKey: requestIdempotencyKey || undefined,
      isArchived: false,
      status: "pending"
    });

    await createNotification({
      userId: workerId,
      requestId: job._id,
      type: "request_created",
      title: "New Service Request",
      message: `You received a request for ${slot.label} on ${formatDateKey(serviceDate)}.`
    });

    return res.status(201).json(job);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      if (hasKeyPattern(err, "idempotencyKey") && req.idempotencyKey) {
        const existingByIdempotency = await Job.findOne({
          customerId: req.user.userId,
          idempotencyKey: req.idempotencyKey
        });

        if (existingByIdempotency) {
          return res.status(200).json({
            ...existingByIdempotency.toObject(),
            idempotentReplay: true
          });
        }
      }

      if (hasKeyPattern(err, "customerId") && hasKeyPattern(err, "workerId")) {
        return res.status(409).json({ error: "Duplicate pending booking already exists for the same worker and slot" });
      }

      if (hasKeyPattern(err, "customerId") && hasKeyPattern(err, "timeSlotCode")) {
        return res.status(409).json({ error: "Customer already has an overlapping booking in this slot" });
      }

      if (hasKeyPattern(err, "workerId") && hasKeyPattern(err, "timeSlotCode")) {
        return res.status(409).json({ error: "Selected worker is already booked for this slot" });
      }
    }

    return res.status(500).json({ error: "Could not create job request" });
  }
}

async function listCustomerRequests(req, res) {
  try {
    const statusFilter = getStatusFilter(req.query.status);
    const jobs = await Job.find({ customerId: req.user.userId, isArchived: false, ...statusFilter })
      .populate({ path: "workerId", select: "name email", match: { isDeleted: false } })
      .lean()
      .sort({ createdAt: -1 });

    const activeJobs = jobs.filter((job) => Boolean(job.workerId));

    const jobIds = activeJobs.map((job) => job._id);
    const reviews = await Review.find({
      customerId: req.user.userId,
      jobId: { $in: jobIds }
    }).select("jobId rating");

    const reviewByJobId = reviews.reduce((acc, review) => {
      acc[String(review.jobId)] = review.rating;
      return acc;
    }, {});

    const enriched = activeJobs.map((job) => ({
      ...job,
      hasReview: reviewByJobId[String(job._id)] !== undefined,
      submittedRating: reviewByJobId[String(job._id)] ?? null
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Could not load requests" });
  }
}

async function listWorkerInbox(req, res) {
  try {
    const statusFilter = getStatusFilter(req.query.status);
    const jobs = await Job.find({ workerId: req.user.userId, isArchived: false, ...statusFilter })
      .populate({ path: "customerId", select: "name email", match: { isDeleted: false } })
      .sort({ createdAt: -1 });

    res.json(jobs.filter((job) => Boolean(job.customerId)));
  } catch (err) {
    res.status(500).json({ error: "Could not load worker inbox" });
  }
}

async function acceptRequest(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid request id" });
    }

    const existing = await Job.findOne({ _id: req.params.id, isArchived: false });
    if (!existing || String(existing.workerId) !== req.user.userId) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (!["pending", "requested"].includes(existing.status)) {
      return res.status(400).json({ error: "Only pending requests can be accepted" });
    }

    if (existing.serviceDate && existing.timeSlotCode) {
      const acceptedCustomerConflict = await Job.findOne({
        _id: { $ne: existing._id },
        customerId: existing.customerId,
        serviceDate: existing.serviceDate,
        timeSlotCode: existing.timeSlotCode,
        isArchived: false,
        status: "accepted"
      }).select("_id");

      if (acceptedCustomerConflict) {
        return res.status(409).json({ error: "Customer already has an accepted booking in this slot" });
      }
    }

    const slotLockKey = buildSlotLockKey({
      workerId: existing.workerId,
      serviceDate: existing.serviceDate,
      timeSlotCode: existing.timeSlotCode
    });

    const updateData = {
      status: "accepted",
      rejectionReason: "",
      acceptedAt: new Date()
    };
    if (slotLockKey) {
      updateData.slotLockKey = slotLockKey;
    }

    const job = await Job.findOneAndUpdate(
      {
        _id: req.params.id,
        workerId: req.user.userId,
        isArchived: false,
        status: { $in: ["pending", "requested"] }
      },
      updateData,
      { new: true }
    );

    if (!job) {
      return res.status(409).json({ error: "Request already processed" });
    }

    if (job.serviceDate && job.timeSlotCode) {
      const conflictingJobs = await Job.find({
        _id: { $ne: job._id },
        workerId: job.workerId,
        serviceDate: job.serviceDate,
        timeSlotCode: job.timeSlotCode,
        isArchived: false,
        status: { $in: ["pending", "requested"] }
      }).select("_id customerId");

      const conflictIds = conflictingJobs.map((item) => item._id);
      if (conflictIds.length) {
        await Job.updateMany(
          { _id: { $in: conflictIds } },
          { status: "rejected", rejectionReason: "Time slot no longer available" }
        );

        await Promise.all(conflictingJobs.map((conflictJob) => createNotification({
          userId: conflictJob.customerId,
          requestId: conflictJob._id,
          type: "request_rejected",
          title: "Request Rejected",
          message: "This request was rejected because the selected slot has already been booked."
        })));
      }

      const customerSlotConflicts = await Job.find({
        _id: { $ne: job._id },
        customerId: job.customerId,
        serviceDate: job.serviceDate,
        timeSlotCode: job.timeSlotCode,
        isArchived: false,
        status: { $in: ["pending", "requested"] }
      }).select("_id");

      const customerConflictIds = customerSlotConflicts.map((item) => item._id);
      if (customerConflictIds.length) {
        await Job.updateMany(
          { _id: { $in: customerConflictIds } },
          { status: "rejected", rejectionReason: "Another booking for this slot has already been accepted" }
        );
      }
    }

    await createNotification({
      userId: job.customerId,
      requestId: job._id,
      type: "request_accepted",
      title: "Request Accepted",
      message: "Your service request has been accepted by the worker."
    });

    res.json(job);
  } catch (err) {
    if (err?.code === 11000) {
      if (hasKeyPattern(err, "workerId") && hasKeyPattern(err, "timeSlotCode")) {
        return res.status(409).json({ error: "Selected worker is already booked for this slot" });
      }
      if (hasKeyPattern(err, "customerId") && hasKeyPattern(err, "timeSlotCode")) {
        return res.status(409).json({ error: "Customer already has an active booking in this slot" });
      }
      return res.status(409).json({ error: "Request could not be accepted due to booking conflict" });
    }
    res.status(500).json({ error: "Could not accept request" });
  }
}

async function rejectRequest(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid request id" });
    }

    const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const job = await Job.findOneAndUpdate(
      {
        _id: req.params.id,
        workerId: req.user.userId,
        isArchived: false,
        status: { $in: ["pending", "requested"] }
      },
      { status: "rejected", rejectionReason: reason },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ error: "Pending request not found" });
    }

    await createNotification({
      userId: job.customerId,
      requestId: job._id,
      type: "request_rejected",
      title: "Request Rejected",
      message: `Worker rejected your request. Reason: ${reason}`
    });

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: "Could not reject request" });
  }
}

async function completeRequest(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid request id" });
    }

    const isAdmin = req.user.role === "admin";
    const filter = {
      _id: req.params.id,
      isArchived: false,
      status: "accepted"
    };

    if (!isAdmin) {
      filter.workerId = req.user.userId;
    }

    const job = await Job.findOneAndUpdate(
      filter,
      { status: "completed", completedAt: new Date() },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ error: "Accepted request not found" });
    }

    const worker = await WorkerProfile.findOne({ userId: job.workerId });
    if (worker) {
      worker.trustScore = await calculateTrustScore(job.workerId);
      await worker.save();
    }

    await createNotification({
      userId: job.customerId,
      requestId: job._id,
      type: "request_completed",
      title: "Service Completed",
      message: "Your service request is marked completed. Please leave a review."
    });

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: "Could not complete request" });
  }
}

async function cancelRequest(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid request id" });
    }

    const job = await Job.findOneAndUpdate(
      {
        _id: req.params.id,
        customerId: req.user.userId,
        isArchived: false,
        status: { $in: ["pending", "requested"] }
      },
      { status: "cancelled", rejectionReason: "Cancelled by customer" },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ error: "Pending request not found" });
    }

    await createNotification({
      userId: job.workerId,
      requestId: job._id,
      type: "request_cancelled",
      title: "Request Cancelled",
      message: "Customer cancelled the service request."
    });

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: "Could not cancel request" });
  }
}

router.get("/time-slots", (req, res) => {
  res.json(Object.values(TIME_SLOTS));
});

router.post("/", auth, role("customer"), bookingIpLimiter, bookingUserLimiter, bookingCooldown, idempotencyKey, createJobRequest);
router.post("/create", auth, role("customer"), bookingIpLimiter, bookingUserLimiter, bookingCooldown, idempotencyKey, createJobRequest);
router.get("/my-requests", auth, role("customer"), listCustomerRequests);
router.get("/my-inbox", auth, role("worker"), listWorkerInbox);
router.patch("/:id/accept", auth, role("worker"), acceptRequest);
router.patch("/accept/:id", auth, role("worker"), acceptRequest);
router.patch("/:id/reject", auth, role("worker"), rejectRequest);
router.patch("/:id/complete", auth, completeRequest);
router.patch("/complete/:id", auth, completeRequest);
router.patch("/:id/cancel", auth, role("customer"), cancelRequest);

module.exports = router;
