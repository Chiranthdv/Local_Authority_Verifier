const auth = require("./auth");

module.exports = (req, res, next) => {
  if (typeof next !== "function") {
    return res.status(500).json({ error: "Admin middleware misconfigured", message: "next is not a function" });
  }

  return auth(req, res, (authError) => {
    if (authError) {
      return next(authError);
    }

    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    return next();
  });
};
