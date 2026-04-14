const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
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
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job"
  },
  lastMessage: {
    type: String,
    default: ""
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isDisabled: {
    type: Boolean,
    default: false,
    index: true
  },
  disabledAt: {
    type: Date,
    default: null
  },
  disabledReason: {
    type: String,
    default: ""
  }
}, { timestamps: true });

conversationSchema.index({ customerId: 1, workerId: 1 }, { unique: true });
conversationSchema.index({ customerId: 1, lastMessageAt: -1 });
conversationSchema.index({ workerId: 1, lastMessageAt: -1 });
conversationSchema.index({ isDisabled: 1, updatedAt: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);
