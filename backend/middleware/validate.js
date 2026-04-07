const { validationResult } = require("express-validator");

module.exports = (req, res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    errors: result.array().map((error) => ({
      field: error.path,
      message: error.msg
    }))
  });
};
