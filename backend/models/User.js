const mongoose = require("mongoose");
const WorkerProfile = require("./WorkerProfile");
const Document = require("./Document");
const Job = require("./Job");
const Review = require("./Review");

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  password: String,
  role: {
    type: String,
    enum: ["customer", "worker", "admin"],
    default: "customer"
  }
}, { timestamps: true });

async function cleanupRelatedData(userId) {
  await Promise.all([
    WorkerProfile.deleteMany({ userId }),
    Document.deleteMany({ userId }),
    Job.deleteMany({ $or: [{ customerId: userId }, { workerId: userId }] }),
    Review.deleteMany({ $or: [{ customerId: userId }, { workerId: userId }] })
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
