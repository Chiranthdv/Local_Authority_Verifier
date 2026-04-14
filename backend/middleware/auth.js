const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  if (typeof next !== "function") {
    return res.status(500).json({ error: "Auth middleware misconfigured", message: "next is not a function" });
  }

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: payload.userId, isDeleted: false }).select("_id role isDeleted");

    if (!user) {
      return res.status(401).json({ error: "Account is unavailable" });
    }

    req.user = { userId: String(user._id), role: user.role };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
