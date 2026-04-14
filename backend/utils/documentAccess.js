const jwt = require("jsonwebtoken");

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
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/api/documents/file/${documentId}?token=${encodeURIComponent(token)}`;
}

module.exports = {
  signDocumentAccessToken,
  verifyDocumentAccessToken,
  buildSignedDocumentUrl
};
