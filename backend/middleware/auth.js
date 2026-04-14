const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
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
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};
