const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const WorkerProfile = require("./WorkerProfile");
const Document = require("./Document");
const Job = require("./Job");
const Review = require("./Review");
const Notification = require("./Notification");
const NotificationOutbox = require("./NotificationOutbox");
const Conversation = require("./Conversation");
const Message = require("./Message");

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;
const DEFAULT_SALT_ROUNDS = 12;

function getSaltRounds() {
  const parsed = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS, 10);
  if (!Number.isInteger(parsed)) return DEFAULT_SALT_ROUNDS;
  return Math.min(Math.max(parsed, 10), 14);
}

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  failedLoginAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  lockUntil: {
    type: Date,
    default: null,
    select: false
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null,
    select: false
  },
  role: {
    type: String,
    enum: ["customer", "worker", "admin"],
    default: "customer"
  }
}, { timestamps: true });

userSchema.pre("save", async function(next) {
  try {
    if (typeof this.name === "string") {
      this.name = this.name.trim().replace(/\s+/g, " ");
    }

    if (typeof this.email === "string") {
      this.email = this.email.trim().toLowerCase();
    }

    if (!this.isModified("password")) {
      return next();
    }

    if (typeof this.password !== "string" || !this.password) {
      return next(new Error("Password is required"));
    }

    const rawPassword = this.password;
    if (BCRYPT_HASH_PATTERN.test(rawPassword)) {
      this.password = rawPassword;
      return next();
    }

    if (rawPassword.length < 8) {
      return next(new Error("Password must be at least 8 characters"));
    }

    this.password = await bcrypt.hash(rawPassword, getSaltRounds());
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.comparePassword = function comparePassword(plainPassword) {
  if (typeof plainPassword !== "string" || !plainPassword || !this.password) {
    return Promise.resolve(false);
  }

  return bcrypt.compare(plainPassword, this.password);
};

async function cleanupRelatedData(userId) {
  await Promise.all([
    WorkerProfile.deleteMany({ userId }),
    Document.deleteMany({ userId }),
    Job.deleteMany({ $or: [{ customerId: userId }, { workerId: userId }] }),
    Review.deleteMany({ $or: [{ customerId: userId }, { workerId: userId }] }),
    Notification.deleteMany({ userId }),
    NotificationOutbox.deleteMany({ userId }),
    Conversation.deleteMany({ $or: [{ customerId: userId }, { workerId: userId }] }),
    Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] })
  ]);
}

userSchema.pre("findOneAndDelete", async function(next) {
  const user = await this.model.findOne(this.getFilter()).select("_id");

  if (user) {
    await cleanupRelatedData(user._id);
  }

  next();
});

userSchema.pre("deleteOne", { document: true, query: false }, async function(next) {
  await cleanupRelatedData(this._id);
  next();
});

module.exports = mongoose.model("User", userSchema);
