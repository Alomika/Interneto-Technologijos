const sonarjs = require("eslint-plugin-sonarjs");

module.exports = [
  {
    ignores: ["plato-report/**", "eslint.config.js", "lint-cognitive.config.mjs"]
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs"
    },
    plugins: {
      sonarjs
    },
    rules: {
      "complexity": ["error", 1],
      "sonarjs/cognitive-complexity": ["error", 1]
    }
  }
];