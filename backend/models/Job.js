const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  workerProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WorkerProfile",
    index: true
  },

  description: {
    type: String,
    default: ""
  },
  address: {
    type: String,
    default: ""
  },
  serviceDate: Date,
  timeSlotCode: String,
  timeSlotLabel: String,
  scheduledTime: Date,
  rejectionReason: {
    type: String,
    default: ""
  },
  acceptedAt: Date,
  completedAt: Date,
  slotLockKey: {
    type: String
  },
  idempotencyKey: {
    type: String,
    trim: true,
    maxlength: 128,
    select: false
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  archivedAt: {
    type: Date,
    default: null
  },
  archivedReason: {
    type: String,
    default: ""
  },

  status: {
    type: String,
    enum: ["requested", "pending", "accepted", "rejected", "completed", "cancelled"],
    default: "pending"
  }

}, { timestamps: true });

jobSchema.index({ workerId: 1, serviceDate: 1, timeSlotCode: 1, status: 1 });
jobSchema.index({ customerId: 1, createdAt: -1 });
jobSchema.index({ workerId: 1, createdAt: -1 });
jobSchema.index({ customerId: 1, isArchived: 1, createdAt: -1 });
jobSchema.index({ workerId: 1, isArchived: 1, createdAt: -1 });
jobSchema.index({ slotLockKey: 1 }, { unique: true, sparse: true });
jobSchema.index(
  { customerId: 1, workerId: 1, serviceDate: 1, timeSlotCode: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "requested"] } }
  }
);
jobSchema.index(
  { customerId: 1, serviceDate: 1, timeSlotCode: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "requested", "accepted"] } }
  }
);
jobSchema.index(
  { workerId: 1, serviceDate: 1, timeSlotCode: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "accepted" }
  }
);
jobSchema.index(
  { customerId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } }
  }
);

module.exports = mongoose.model("Job", jobSchema);
