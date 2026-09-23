import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Lint du projet. Deux familles de règles comptent vraiment ici :
 *  - les variables inconnues ou inutilisées (fautes de frappe, restes de refonte) ;
 *  - les règles des hooks React : une dépendance oubliée dans un useEffect ou
 *    un useCallback donne des bugs discrets (valeur figée, effet qui ne se
 *    relance pas), exactement ceux qu'on ne voit pas en testant à la main.
 */
export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Les composants sont utilisés en JSX, que la règle de base ne voit pas.
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["scripts/**", "tests/**", "*.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
