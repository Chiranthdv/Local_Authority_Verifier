const {
  sanitizeName,
  sanitizeEmail,
  sanitizeRole,
  extractPassword,
  EMAIL_PATTERN,
  isValidRegistrationRole
} = require("../../utils/authValidation");

describe("Auth validation helpers", () => {
  test("sanitizeName trims, normalizes whitespace, and preserves spaces", () => {
    expect(sanitizeName("  Alice   Smith  ")).toBe("Alice Smith");
  });

  test("sanitizeEmail trims and lowercases the email", () => {
    expect(sanitizeEmail("  EXAMPLE@Domain.COM  ")).toBe("example@domain.com");
  });

  test("sanitizeRole normalizes roles to lowercase", () => {
    expect(sanitizeRole("  WORKER ")).toBe("worker");
  });

  test("extractPassword returns an empty string for non-string input", () => {
    expect(extractPassword(null)).toBe("");
    expect(extractPassword(123)).toBe("");
  });

  test("EMAIL_PATTERN only matches valid email formats", () => {
    expect(EMAIL_PATTERN.test("invalid-email")).toBe(false);
    expect(EMAIL_PATTERN.test("valid.user@example.com")).toBe(true);
  });

  test("registration role validation allows worker and customer only", () => {
    expect(isValidRegistrationRole("worker")).toBe(true);
    expect(isValidRegistrationRole("customer")).toBe(true);
    expect(isValidRegistrationRole("admin")).toBe(false);
  });
});
