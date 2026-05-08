const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const router = express.Router();
const upload = require("../config/multer");
const Document = require("../models/Document");
const WorkerProfile = require("../models/WorkerProfile");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const { storageService } = require("../services/storageService");
const {
  buildSignedDocumentUrl,
  verifyDocumentAccessToken,
  getDocumentFilePath
} = require("../utils/documentAccess");

const ALLOWED_DOCUMENT_TYPES = new Set(["certificate"]);

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
    rejectionReason: plain.rejectionReason,
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

router.post("/upload", auth, role("worker"), upload.single("file"), async (req, res) => {
  try {
    console.log("[DOCUMENT UPLOAD] Request received");
    console.log("[DOCUMENT UPLOAD] req.file raw:", req.file);
    console.log("[DOCUMENT UPLOAD] File:", req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: Buffer.isBuffer(req.file.buffer)
    } : "No file received");
    console.log("[DOCUMENT UPLOAD] Body:", req.body);

    if (!req.file) {
      console.log("[DOCUMENT UPLOAD] No file provided");
      return res.status(400).json({ error: "Document file is required" });
    }

    const documentType = req.body?.documentType || req.body?.type;
    if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
      return res.status(400).json({ error: "documentType must be certificate" });
    }

    let workerProfile = await WorkerProfile.findOne({ userId: req.user.userId }).select("_id verificationStatus isDeleted");
    if (!workerProfile) {
      console.log("[DOCUMENT UPLOAD] Worker profile missing. Creating draft profile before upload.");
      workerProfile = await WorkerProfile.create({
        userId: req.user.userId,
        verificationStatus: "pending",
        rejectionReason: ""
      });
      console.log("[DOCUMENT UPLOAD] Draft worker profile created:", String(workerProfile._id));
    } else if (workerProfile.isDeleted) {
      workerProfile.isDeleted = false;
      workerProfile.deletedAt = null;
      workerProfile.verificationStatus = "pending";
      workerProfile.rejectionReason = "";
      await workerProfile.save();
      console.log("[DOCUMENT UPLOAD] Revived soft-deleted worker profile:", String(workerProfile._id));
    }

    const storedFile = await storageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "documents"
    );

    const doc = await Document.create({
      userId: req.user.userId,
      documentType,
      fileUrl: storedFile.url,
      fileKey: storedFile.key,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      status: "pending",
      reviewNote: "",
      rejectionReason: ""
    });

    if (workerProfile.verificationStatus !== "pending") {
      workerProfile.verificationStatus = "pending";
      workerProfile.rejectionReason = "";
      await workerProfile.save();
    }

    res.status(201).json(toDocumentResponse(req, doc, "owner_access", req.user.userId));
  } catch (err) {
    console.error("[DOCUMENT UPLOAD] Error:", {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
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

router.get("/:workerId", auth, role("worker", "admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.workerId)) {
      return res.status(400).json({ error: "Invalid worker id" });
    }

    if (req.user.role === "worker" && String(req.params.workerId) !== String(req.user.userId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const scope = req.user.role === "admin" ? "admin_access" : "owner_access";
    const documents = await Document.find({ userId: req.params.workerId }).sort({ createdAt: -1 });
    return res.json(documents.map((doc) => toDocumentResponse(req, doc, scope, req.user.userId)));
  } catch (err) {
    return res.status(500).json({ error: "Could not load worker documents" });
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

    const doc = await Document.findById(req.params.id).select("_id userId documentType status mimeType fileUrl fileKey originalName");
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

    const absolutePath = getDocumentFilePath(doc);
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
        rejectionReason: "",
        reviewedBy: req.user.userId,
        reviewedAt: new Date()
      },
      { returnDocument: "after" }
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
    if (!reviewNote) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        reviewNote,
        rejectionReason: reviewNote,
        reviewedBy: req.user.userId,
        reviewedAt: new Date()
      },
      { returnDocument: "after" }
    );

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json(toDocumentResponse(req, doc, "admin_access", req.user.userId));
  } catch (err) {
    res.status(500).json({ error: "Could not reject document" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid document id" });
    }

    const doc = await Document.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Only allow deletion of pending documents
    if (doc.status !== "pending") {
      return res.status(403).json({ error: "Cannot delete approved or rejected documents" });
    }

    // Delete the physical file
    if (doc.fileKey) {
      await storageService.deleteFile(doc.fileKey);
    } else {
      const absolutePath = getDocumentFilePath(doc);
      if (absolutePath && fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
      }
    }

    // Delete from database
    await Document.findByIdAndDelete(req.params.id);

    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Could not delete document" });
  }
});

module.exports = router;
