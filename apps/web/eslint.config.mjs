import base from "../../eslint.config.mjs";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";

export default [
  ...base,
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { react, "react-hooks": hooks, "jsx-a11y": a11y },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...hooks.configs.recommended.rules,
      ...a11y.configs.recommended.rules,
      "react/prop-types": "off",
    },
  },
];
