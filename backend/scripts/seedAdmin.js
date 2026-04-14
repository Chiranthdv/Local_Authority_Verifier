const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const User = require("../models/User");

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeEmail(value) {
  return sanitizeText(value).toLowerCase();
}

async function run() {
  const email = sanitizeEmail(process.env.ADMIN_SEED_EMAIL);
  const password = sanitizeText(process.env.ADMIN_SEED_PASSWORD);
  const name = sanitizeText(process.env.ADMIN_SEED_NAME) || "Platform Admin";

  if (!email || !password) {
    throw new Error("ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  let user = await User.findOne({ email }).select("+password name role isDeleted deletedAt");
  if (!user) {
    user = new User({
      name,
      email,
      password,
      role: "admin"
    });
    await user.save();
    console.log(`[seed-admin] Created admin user: ${email}`);
    return;
  }

  user.name = name;
  user.role = "admin";
  user.isDeleted = false;
  user.deletedAt = null;
  user.password = password;
  await user.save();
  console.log(`[seed-admin] Updated existing user as admin: ${email}`);
}

run()
  .catch((error) => {
    console.error("[seed-admin] Failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
