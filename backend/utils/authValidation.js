const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_REGISTRATION_ROLES = new Set(["customer", "worker"]);

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeName(value) {
  return sanitizeText(value).replace(/\s+/g, " ");
}

function sanitizeEmail(value) {
  return sanitizeText(value).toLowerCase();
}

function sanitizeRole(value) {
  return sanitizeText(value).toLowerCase();
}

function extractPassword(value) {
  return typeof value === "string" ? value : "";
}

function isValidRegistrationRole(role) {
  return PUBLIC_REGISTRATION_ROLES.has(sanitizeRole(role));
}

module.exports = {
  EMAIL_PATTERN,
  sanitizeText,
  sanitizeName,
  sanitizeEmail,
  sanitizeRole,
  extractPassword,
  isValidRegistrationRole
};
