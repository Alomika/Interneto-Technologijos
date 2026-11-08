export default [
  {
    ignores: ["plato-report/**", "eslint.config.js", "lint-cognitive.config.mjs", "lint-cc.config.mjs"]
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs"
    },
    rules: {
      "complexity": ["error", 1]
    }
  }
];