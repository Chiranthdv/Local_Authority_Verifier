const multer = require("multer");
const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, and PDF files are allowed"));
    }

    cb(null, true);
  }
});

module.exports = upload;
