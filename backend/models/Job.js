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

// When a job becomes accepted, ensure an active Conversation exists for it.
// This makes chat available immediately after worker accepts booking.
jobSchema.post('findOneAndUpdate', async function (doc) {
  try {
    if (!doc || doc.status !== 'accepted') return;

    const Conversation = require('./Conversation');

    // If Conversation exists, ensure it is enabled and points to the job.
    // Conversation schema has unique {customerId, workerId}
    let conversation = await Conversation.findOne({
      customerId: doc.customerId,
      workerId: doc.workerId
    });

    if (!conversation) {
      await Conversation.create({
        customerId: doc.customerId,
        workerId: doc.workerId,
        jobId: doc._id,
        lastMessage: '',
        lastMessageAt: new Date(),
        isDisabled: false
      });
      return;
    }

    if (conversation.isDisabled) {
      conversation.isDisabled = false;
      conversation.disabledAt = null;
      conversation.disabledReason = '';
    }

    if (String(conversation.jobId || '') !== String(doc._id)) {
      conversation.jobId = doc._id;
    }

    conversation.lastMessageAt = conversation.lastMessageAt || new Date();
    await conversation.save();
  } catch (e) {
    // Avoid breaking booking flow if conversation creation fails.
    // Chat will still become available once users open /chats/start.
  }
});

module.exports = mongoose.model("Job", jobSchema);

