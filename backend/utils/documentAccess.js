const jwt = require("jsonwebtoken");
const path = require("path");
const { storageService } = require("../services/storageService");

const DEFAULT_EXPIRY = "15m";

function getSigningSecret() {
  const secret = process.env.DOCUMENT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("DOCUMENT_ACCESS_SECRET or JWT_SECRET must be configured");
  }
  return secret;
}

function signDocumentAccessToken({ documentId, scope, actorUserId, expiresIn = DEFAULT_EXPIRY }) {
  if (!documentId || !scope) {
    throw new Error("documentId and scope are required");
  }

  const payload = {
    documentId: String(documentId),
    scope: String(scope),
    actorUserId: actorUserId ? String(actorUserId) : undefined
  };

  return jwt.sign(payload, getSigningSecret(), { expiresIn });
}

function verifyDocumentAccessToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    return jwt.verify(token, getSigningSecret());
  } catch (error) {
    return null;
  }
}

function buildSignedDocumentUrl(req, documentId, options = {}) {
  const token = signDocumentAccessToken({ documentId, ...options });
  let host = req.get("host");

  // In Docker environments, internal requests might use 'backend:5001'
  // but the browser (on host) needs 'localhost:5001'.
  if (host && host.includes("backend:")) {
    host = host.replace("backend:", "localhost:");
  } else if (host === "backend") {
    host = "localhost:5001";
  }

  const baseUrl = `${req.protocol}://${host}`;
  return `${baseUrl}/api/documents/file/${documentId}?token=${encodeURIComponent(token)}`;
}

function getDocumentFilePath(documentRecord) {
  if (documentRecord?.fileKey) {
    return storageService.getFilePath(documentRecord.fileKey);
  }

  if (documentRecord?.fileUrl && path.isAbsolute(documentRecord.fileUrl)) {
    return path.resolve(documentRecord.fileUrl);
  }

  return "";
}

module.exports = {
  signDocumentAccessToken,
  verifyDocumentAccessToken,
  buildSignedDocumentUrl,
  getDocumentFilePath
};
