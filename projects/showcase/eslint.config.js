// @ts-check
const rootConfig = require("../../eslint.config.js");

module.exports = [
  ...rootConfig,
  {
    files: ["**/*.ts"],
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // These resource classes mirror ng-ql's NgQlResource constructor-injection
      // pattern (client passed through `super(client, ...)`), which inject() can't express.
      "@angular-eslint/prefer-inject": "off",
    },
  },
  {
    files: ["**/*.html"],
    rules: {},
  }
];
