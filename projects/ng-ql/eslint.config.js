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
          prefix: "ngql",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "ngql",
          style: "kebab-case",
        },
      ],
      // NgQlResource intentionally uses constructor injection so subclasses can
      // pass their client/config through `super(...)`; inject() doesn't fit that shape.
      "@angular-eslint/prefer-inject": "off",
    },
  },
  {
    files: ["**/*.html"],
    rules: {},
  }
];
