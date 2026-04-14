module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  moduleFileExtensions: ["js", "json"],
  verbose: true,
  setupFiles: ["<rootDir>/tests/jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/"]
};
