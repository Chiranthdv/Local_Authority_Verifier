const mongoose = require("mongoose");
const Job = require("../models/Job");
const WorkerProfile = require("../models/WorkerProfile");
const Review = require("../models/Review");
const calculateTrustScore = require("../utils/trustScore");
const { createNotification } = require("../utils/notifications");

const TIME_SLOTS = {
  SLOT_06_10: { code: "SLOT_06_10", label: "06:00-10:00", startHour: 6, endHour: 10 },
  SLOT_10_14: { code: "SLOT_10_14", label: "10:00-14:00", startHour: 10, endHour: 14 },
  SLOT_14_18: { code: "SLOT_14_18", label: "14:00-18:00", startHour: 14, endHour: 18 },
  SLOT_18_22: { code: "SLOT_18_22", label: "18:00-22:00", startHour: 18, endHour: 22 }
};

class JobServiceError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.name = "JobServiceError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeDateOnly(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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

function getTimeSlotByCode(timeSlotCode) {
  const normalized = normalizeStatus(timeSlotCode).toUpperCase();
  return TIME_SLOTS[normalized] || null;
}

function getSlotRange(slotCode) {
  const slot = getTimeSlotByCode(slotCode);
  if (!slot) return null;
  return { startTime: slot.startHour, endTime: slot.endHour };
}

function doRangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

async function checkSlotConflict(workerId, date, startTime, endTime, excludeJobId) {
  const serviceDate = normalizeDateOnly(date);
  if (!isValidObjectId(workerId) || !serviceDate) {
    return false;
  }

  const query = {
    workerId,
    serviceDate,
    isArchived: false,
    status: "accepted"
  };

  if (excludeJobId && isValidObjectId(excludeJobId)) {
    query._id = { $ne: excludeJobId };
  }

  const jobs = await Job.find(query).select("_id timeSlotCode");
  return jobs.some((job) => {
    const range = getSlotRange(job.timeSlotCode);
    if (!range) return false;
    return doRangesOverlap(startTime, endTime, range.startTime, range.endTime);
  });
}

async function createJob(customerId, workerId, slotData, options = {}) {
  const { serviceDate: rawServiceDate, date, timeSlotCode, description, address } = slotData;
  const serviceDate = normalizeDateOnly(rawServiceDate || date);
  const slot = getTimeSlotByCode(timeSlotCode);
  const requestDateKey = serviceDate ? formatDateKey(serviceDate) : "";
  const requestIdempotencyKey = options.idempotencyKey || null;

  if (!isValidObjectId(workerId)) {
    throw new JobServiceError("Invalid worker id", 400);
  }

  if (!serviceDate) {
    throw new JobServiceError("Valid serviceDate is required", 400);
  }

  if (!slot) {
    throw new JobServiceError("Invalid time slot code", 400);
  }

  if (isPastServiceDate(serviceDate)) {
    throw new JobServiceError("Bookings for past dates are not allowed", 400);
  }

  if (requestIdempotencyKey) {
    const existingByIdempotency = await Job.findOne({
      customerId,
      idempotencyKey: requestIdempotencyKey
    });

    if (existingByIdempotency) {
      const samePayload =
        String(existingByIdempotency.workerId) === String(workerId) &&
        formatDateKey(existingByIdempotency.serviceDate) === requestDateKey &&
        String(existingByIdempotency.timeSlotCode) === slot.code;

      if (!samePayload) {
        throw new JobServiceError("Idempotency-Key already used for a different booking payload", 409);
      }

      return {
        job: existingByIdempotency.toObject(),
        created: false,
        idempotentReplay: true
      };
    }
  }

  const workerProfile = await WorkerProfile.findOne({
    userId: workerId,
    verificationStatus: "approved",
    isDeleted: false
  }).populate({ path: "userId", select: "name", match: { isDeleted: false } });

  if (!workerProfile || !workerProfile.userId) {
    throw new JobServiceError("Worker not available for booking", 404);
  }

  const workerConflict = await checkSlotConflict(workerId, serviceDate, slot.startHour, slot.endHour);
  if (workerConflict) {
    throw new JobServiceError("Selected worker is already booked for this slot", 409);
  }

  const existingPendingDuplicate = await Job.findOne({
    customerId,
    workerId,
    serviceDate,
    timeSlotCode: slot.code,
    isArchived: false,
    status: { $in: ["pending", "requested"] }
  }).select("_id");

  if (existingPendingDuplicate) {
    throw new JobServiceError("Duplicate booking request already exists for this slot", 409, {
      existingRequestId: existingPendingDuplicate._id
    });
  }

  const overlappingCustomerBooking = await Job.findOne({
    customerId,
    serviceDate,
    timeSlotCode: slot.code,
    isArchived: false,
    status: { $in: ["pending", "requested", "accepted"] }
  }).select("_id");

  if (overlappingCustomerBooking) {
    throw new JobServiceError("Customer already has a booking in this time slot", 409, {
      existingRequestId: overlappingCustomerBooking._id
    });
  }

  try {
    const job = await Job.create({
      customerId,
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

    return {
      job,
      created: true,
      idempotentReplay: false
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      if (hasKeyPattern(error, "idempotencyKey") && requestIdempotencyKey) {
        const existingByIdempotency = await Job.findOne({
          customerId,
          idempotencyKey: requestIdempotencyKey
        });

        if (existingByIdempotency) {
          return {
            job: existingByIdempotency.toObject(),
            created: false,
            idempotentReplay: true
          };
        }
      }

      if (hasKeyPattern(error, "customerId") && hasKeyPattern(error, "workerId")) {
        throw new JobServiceError("Duplicate pending booking already exists for the same worker and slot", 409);
      }

      if (hasKeyPattern(error, "customerId") && hasKeyPattern(error, "timeSlotCode")) {
        throw new JobServiceError("Customer already has an overlapping booking in this slot", 409);
      }

      if (hasKeyPattern(error, "workerId") && hasKeyPattern(error, "timeSlotCode")) {
        throw new JobServiceError("Selected worker is already booked for this slot", 409);
      }
    }

    throw error;
  }
}

async function listCustomerJobs(customerId, status) {
  const statusFilter = getStatusFilter(status);
  const jobs = await Job.find({ customerId, isArchived: false, ...statusFilter })
    .populate({ path: "workerId", select: "name email", match: { isDeleted: false } })
    .lean()
    .sort({ createdAt: -1 });

  const activeJobs = jobs.filter((job) => Boolean(job.workerId));
  const jobIds = activeJobs.map((job) => job._id);
  const reviews = await Review.find({
    customerId,
    jobId: { $in: jobIds }
  }).select("jobId rating");

  const reviewByJobId = reviews.reduce((acc, review) => {
    acc[String(review.jobId)] = review.rating;
    return acc;
  }, {});

  return activeJobs.map((job) => ({
    ...job,
    hasReview: reviewByJobId[String(job._id)] !== undefined,
    submittedRating: reviewByJobId[String(job._id)] ?? null
  }));
}

async function listWorkerJobs(workerId, status) {
  const statusFilter = getStatusFilter(status);
  const jobs = await Job.find({ workerId, isArchived: false, ...statusFilter })
    .populate({ path: "customerId", select: "name email", match: { isDeleted: false } })
    .sort({ createdAt: -1 });

  return jobs.filter((job) => Boolean(job.customerId));
}

async function acceptJob(jobId, workerId) {
  if (!isValidObjectId(jobId)) {
    throw new JobServiceError("Invalid request id", 400);
  }

  const existing = await Job.findOne({ _id: jobId, isArchived: false });
  if (!existing || String(existing.workerId) !== String(workerId)) {
    throw new JobServiceError("Request not found", 404);
  }

  if (!["pending", "requested"].includes(existing.status)) {
    throw new JobServiceError("Only pending requests can be accepted", 400);
  }

  const slot = getTimeSlotByCode(existing.timeSlotCode);
  if (existing.serviceDate && slot) {
    const workerConflict = await checkSlotConflict(
      existing.workerId,
      existing.serviceDate,
      slot.startHour,
      slot.endHour,
      existing._id
    );

    if (workerConflict) {
      throw new JobServiceError("Selected worker is already booked for this slot", 409);
    }

    const acceptedCustomerConflict = await Job.findOne({
      _id: { $ne: existing._id },
      customerId: existing.customerId,
      serviceDate: existing.serviceDate,
      timeSlotCode: existing.timeSlotCode,
      isArchived: false,
      status: "accepted"
    }).select("_id");

    if (acceptedCustomerConflict) {
      throw new JobServiceError("Customer already has an accepted booking in this slot", 409);
    }
  }

  const updateData = {
    status: "accepted",
    rejectionReason: "",
    acceptedAt: new Date()
  };

  const slotLockKey = buildSlotLockKey({
    workerId: existing.workerId,
    serviceDate: existing.serviceDate,
    timeSlotCode: existing.timeSlotCode
  });
  if (slotLockKey) {
    updateData.slotLockKey = slotLockKey;
  }

  try {
    const job = await Job.findOneAndUpdate(
      {
        _id: jobId,
        workerId,
        isArchived: false,
        status: { $in: ["pending", "requested"] }
      },
      updateData,
      { returnDocument: "after" }
    );

    if (!job) {
      throw new JobServiceError("Request already processed", 409);
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

    return job;
  } catch (error) {
    if (error instanceof JobServiceError) {
      throw error;
    }

    if (isDuplicateKeyError(error)) {
      if (hasKeyPattern(error, "workerId") && hasKeyPattern(error, "timeSlotCode")) {
        throw new JobServiceError("Selected worker is already booked for this slot", 409);
      }
      if (hasKeyPattern(error, "customerId") && hasKeyPattern(error, "timeSlotCode")) {
        throw new JobServiceError("Customer already has an active booking in this slot", 409);
      }
      throw new JobServiceError("Request could not be accepted due to booking conflict", 409);
    }

    throw error;
  }
}

async function rejectJob(jobId, workerId, reason) {
  if (!isValidObjectId(jobId)) {
    throw new JobServiceError("Invalid request id", 400);
  }

  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  if (!cleanReason) {
    throw new JobServiceError("Rejection reason is required", 400);
  }

  const job = await Job.findOneAndUpdate(
    {
      _id: jobId,
      workerId,
      isArchived: false,
      status: { $in: ["pending", "requested"] }
    },
    { status: "rejected", rejectionReason: cleanReason },
    { returnDocument: "after" }
  );

  if (!job) {
    throw new JobServiceError("Pending request not found", 404);
  }

  await createNotification({
    userId: job.customerId,
    requestId: job._id,
    type: "request_rejected",
    title: "Request Rejected",
    message: `Worker rejected your request. Reason: ${cleanReason}`
  });

  return job;
}

async function completeJob(jobId, actor) {
  if (!isValidObjectId(jobId)) {
    throw new JobServiceError("Invalid request id", 400);
  }

  const isAdmin = actor.role === "admin";
  const filter = {
    _id: jobId,
    isArchived: false,
    status: "accepted"
  };

  if (!isAdmin) {
    filter.workerId = actor.userId;
  }

  const job = await Job.findOneAndUpdate(
    filter,
    { status: "completed", completedAt: new Date() },
    { returnDocument: "after" }
  );

  if (!job) {
    throw new JobServiceError("Accepted request not found", 404);
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

  return job;
}

async function cancelJob(jobId, userId, role) {
  if (!isValidObjectId(jobId)) {
    throw new JobServiceError("Invalid request id", 400);
  }

  const filter = {
    _id: jobId,
    isArchived: false,
    status: { $in: ["pending", "requested"] }
  };

  if (role === "customer") {
    filter.customerId = userId;
  } else if (role !== "admin") {
    throw new JobServiceError("Forbidden", 403);
  }

  const job = await Job.findOneAndUpdate(
    filter,
    { status: "cancelled", rejectionReason: "Cancelled by customer" },
    { returnDocument: "after" }
  );

  if (!job) {
    throw new JobServiceError("Pending request not found", 404);
  }

  await createNotification({
    userId: job.workerId,
    requestId: job._id,
    type: "request_cancelled",
    title: "Request Cancelled",
    message: "Customer cancelled the service request."
  });

  return job;
}

function getTimeSlots() {
  return Object.values(TIME_SLOTS);
}

module.exports = {
  TIME_SLOTS,
  JobServiceError,
  createJob,
  acceptJob,
  cancelJob,
  checkSlotConflict,
  rejectJob,
  completeJob,
  listCustomerJobs,
  listWorkerJobs,
  getTimeSlots
};
