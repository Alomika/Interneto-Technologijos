import sonarjs from "eslint-plugin-sonarjs";

export default [
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
      "sonarjs/cognitive-complexity": ["error", 1]
    }
  }
];