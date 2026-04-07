const mongoose = require("mongoose");

const workerProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  category: {
    type: String,
    enum: ["plumber", "electrician", "carpenter", "cleaner", "painter", "mechanic", "gardener"]
  },
  experience: Number,
  location: String,
  bio: {
    type: String,
    default: ""
  },
  skills: {
    type: [String],
    default: []
  },
  hourlyRate: {
    type: Number,
    default: 0
  },
  phone: {
    type: String,
    default: ""
  },
  photoUrl: {
    type: String,
    default: ""
  },

  verificationStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  trustScore: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

module.exports = mongoose.model("WorkerProfile", workerProfileSchema);
