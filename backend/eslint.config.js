// Backend ESLint Configuration (flat config for ESLint v9+)
const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        // Node.js globals
        __dirname: "readonly",
        __filename: "readonly",
        module: "writable",
        require: "readonly",
        exports: "writable",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        // Jest globals
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        jest: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
      "prefer-const": "warn",
      "no-var": "warn",
      "eqeqeq": "off",
      "no-empty": "warn",
      "no-undef": "warn",
      "no-redeclare": "warn",
      "no-constant-condition": "warn",
      "no-prototype-builtins": "off",
      "no-useless-escape": "warn",
      "no-fallthrough": "warn",
      "no-case-declarations": "warn",
      "no-async-promise-executor": "warn",
      "no-useless-catch": "warn",
      "no-control-regex": "warn",
    },
  },
  {
    ignores: ["node_modules/", "temp/", "storage/", "coverage/", "scripts/"],
  },
];
