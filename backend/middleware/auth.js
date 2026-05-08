const jwt = require("jsonwebtoken");
const User = require("../models/User");

function parseCookies(cookieHeader) {
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) {
    return {};
  }

  return cookieHeader.split(";").reduce((acc, pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      return acc;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
}

module.exports = async (req, res, next) => {
  if (typeof next !== "function") {
    return res.status(500).json({ error: "Auth middleware misconfigured", message: "next is not a function" });
  }

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.accessToken || req.headers.authorization?.split(" ")[1];

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
