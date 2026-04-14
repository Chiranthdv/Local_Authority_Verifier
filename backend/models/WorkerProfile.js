const mongoose = require("mongoose");
const crypto = require("crypto");

function createPublicRef() {
  return crypto.randomBytes(16).toString("hex");
}

const workerProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true
  },
  age: {
    type: Number,
    min: 18,
    max: 80
  },
  category: {
    type: String,
    enum: ["plumber", "electrician", "carpenter", "cleaner", "painter", "mechanic", "gardener"]
  },
  experience: Number,
  location: String,
  searchLocation: {
    type: String,
    default: ""
  },
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
  publicRef: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    default: createPublicRef
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },

  verificationStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  rejectionReason: {
    type: String,
    default: ""
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  verifiedAt: Date,

  trustScore: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

workerProfileSchema.index({ verificationStatus: 1, createdAt: -1 });
workerProfileSchema.index({ category: 1, searchLocation: 1, verificationStatus: 1, createdAt: -1 });

workerProfileSchema.pre("save", function() {
  this.searchLocation = typeof this.location === "string" ? this.location.trim().toLowerCase() : "";
});

module.exports = mongoose.model("WorkerProfile", workerProfileSchema);
