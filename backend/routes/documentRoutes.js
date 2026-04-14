const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const upload = require("../config/multer");
const Document = require("../models/Document");
const WorkerProfile = require("../models/WorkerProfile");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const { buildSignedDocumentUrl, verifyDocumentAccessToken } = require("../utils/documentAccess");

const ALLOWED_DOCUMENT_TYPES = new Set(["id_proof", "certificate"]);
const UPLOADS_ROOT = path.resolve(path.join(__dirname, "..", "uploads"));

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function toDocumentResponse(req, doc, scope, actorUserId) {
  const plain = doc.toObject ? doc.toObject() : doc;
  return {
    _id: plain._id,
    userId: plain.userId,
    documentType: plain.documentType,
    originalName: plain.originalName,
    mimeType: plain.mimeType,
    fileSize: plain.fileSize,
    status: plain.status,
    reviewNote: plain.reviewNote,
    reviewedBy: plain.reviewedBy,
    reviewedAt: plain.reviewedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    downloadUrl: buildSignedDocumentUrl(req, plain._id, {
      scope,
      actorUserId,
      expiresIn: scope === "public_certificate" ? "30m" : "15m"
    })
  };
}

function resolveDocumentPath(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") {
    return "";
  }

  const absolutePath = path.resolve(fileUrl);
  if (!absolutePath.startsWith(UPLOADS_ROOT)) {
    return "";
  }

  return absolutePath;
}

router.post("/upload", auth, role("worker"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Document file is required" });
    }

    const { documentType } = req.body;
    if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
      return res.status(400).json({ error: "documentType must be id_proof or certificate" });
    }

    const workerProfile = await WorkerProfile.findOne({ userId: req.user.userId, isDeleted: false }).select("_id verificationStatus");
    if (!workerProfile) {
      return res.status(400).json({ error: "Create worker profile before uploading documents" });
    }

    const doc = await Document.create({
      userId: req.user.userId,
      documentType,
      fileUrl: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      status: "pending",
      reviewNote: ""
    });

    if (workerProfile.verificationStatus !== "pending") {
      workerProfile.verificationStatus = "pending";
      workerProfile.rejectionReason = "";
      await workerProfile.save();
    }

    res.status(201).json(toDocumentResponse(req, doc, "owner_access", req.user.userId));
  } catch (err) {
    res.status(500).json({ error: "Could not upload document" });
  }
});

router.get("/my", auth, role("worker"), async (req, res) => {
  try {
    const documents = await Document.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(documents.map((doc) => toDocumentResponse(req, doc, "owner_access", req.user.userId)));
  } catch (err) {
    res.status(500).json({ error: "Could not load documents" });
  }
});

router.get("/worker/:workerUserId", auth, role("admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.workerUserId)) {
      return res.status(400).json({ error: "Invalid worker user id" });
    }

    const documents = await Document.find({ userId: req.params.workerUserId }).sort({ createdAt: -1 });
    res.json(documents.map((doc) => toDocumentResponse(req, doc, "admin_access", req.user.userId)));
  } catch (err) {
    res.status(500).json({ error: "Could not load worker documents" });
  }
});

router.get("/:id/access-url", auth, role("worker", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid document id" });
    }

    const doc = await Document.findById(req.params.id).select("_id userId");
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const isOwner = String(doc.userId) === req.user.userId;
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const scope = req.user.role === "admin" ? "admin_access" : "owner_access";
    const downloadUrl = buildSignedDocumentUrl(req, doc._id, {
      scope,
      actorUserId: req.user.userId
    });

    res.json({ documentId: doc._id, downloadUrl });
  } catch (err) {
    res.status(500).json({ error: "Could not generate document access url" });
  }
});

router.get("/file/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid document id" });
    }

    const tokenPayload = verifyDocumentAccessToken(req.query.token);
    if (!tokenPayload || String(tokenPayload.documentId) !== String(req.params.id)) {
      return res.status(403).json({ error: "Invalid or expired document token" });
    }

    const doc = await Document.findById(req.params.id).select("_id userId documentType status mimeType fileUrl originalName");
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (tokenPayload.scope === "public_certificate") {
      if (doc.documentType !== "certificate" || doc.status !== "approved") {
        return res.status(403).json({ error: "Certificate is not publicly available" });
      }

      const workerProfile = await WorkerProfile.findOne({
        userId: doc.userId,
        verificationStatus: "approved"
      }).select("_id");

      if (!workerProfile) {
        return res.status(403).json({ error: "Certificate owner is not publicly approved" });
      }
    } else if (tokenPayload.scope === "owner_access") {
      if (String(tokenPayload.actorUserId || "") !== String(doc.userId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else if (tokenPayload.scope !== "admin_access") {
      return res.status(403).json({ error: "Invalid access scope" });
    }

    const absolutePath = resolveDocumentPath(doc.fileUrl);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: "Document file not found" });
    }

    if (doc.mimeType) {
      res.type(doc.mimeType);
    }

    return res.sendFile(absolutePath);
  } catch (err) {
    return res.status(500).json({ error: "Could not serve document file" });
  }
});

router.patch("/:id/approve", auth, role("admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid document id" });
    }

    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved",
        reviewNote: "",
        reviewedBy: req.user.userId,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json(toDocumentResponse(req, doc, "admin_access", req.user.userId));
  } catch (err) {
    res.status(500).json({ error: "Could not approve document" });
  }
});

router.patch("/:id/reject", auth, role("admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid document id" });
    }

    const reviewNote = typeof req.body.reason === "string" ? req.body.reason.trim() : "";

    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        reviewNote,
        reviewedBy: req.user.userId,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json(toDocumentResponse(req, doc, "admin_access", req.user.userId));
  } catch (err) {
    res.status(500).json({ error: "Could not reject document" });
  }
});

module.exports = router;
