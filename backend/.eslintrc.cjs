// Backend ESLint Configuration
module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
    jest: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-console": "off",
    "no-process-exit": "off",
    "prefer-const": "warn",
    "no-var": "warn",
    eqeqeq: "off",
    "no-empty": "warn",
    "no-undef": "warn",
    "no-redeclare": "warn",
    "no-constant-condition": "warn",
    "no-prototype-builtins": "off",
  },
  ignorePatterns: ["node_modules/", "temp/", "storage/", "coverage/", "scripts/"],
};
