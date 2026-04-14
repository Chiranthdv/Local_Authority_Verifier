const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  documentType: {
    type: String,
    enum: ["certificate"],
    required: true
  },

  fileUrl: {
    type: String,
    required: true
  },
  originalName: String,
  mimeType: String,
  fileSize: Number,

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  reviewNote: {
    type: String,
    default: ""
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  reviewedAt: Date

}, { timestamps: true });

documentSchema.index({ userId: 1, status: 1, createdAt: -1 });
documentSchema.index({ documentType: 1, status: 1 });

module.exports = mongoose.model("Document", documentSchema);
