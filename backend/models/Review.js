const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true,
    index: true
  },
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

  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  comment: {
    type: String,
    default: ""
  }

}, { timestamps: true });

reviewSchema.index({ jobId: 1, customerId: 1 }, { unique: true });
reviewSchema.index({ workerId: 1, createdAt: -1 });
reviewSchema.index({ workerId: 1, createdAt: -1, _id: -1 });
reviewSchema.index({ workerId: 1, rating: 1 });

module.exports = mongoose.model("Review", reviewSchema);
