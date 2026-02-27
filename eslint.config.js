import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  // Ignorar build e dependências
  {
    ignores: ["dist/**", "node_modules/**", ".wrangler/**"],
  },

  // Base JS recomendada
  js.configs.recommended,

  // TypeScript (flat config)
  ...tseslint.configs.recommended,

  // Regras do app (TS/React)
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // React hooks
      ...reactHooks.configs.recommended.rules,

      /**
       * Para o Codex trabalhar sem quebrar CI:
       * - Não travar PR por "any" enquanto tipamos aos poucos.
       * - Não travar PR por variáveis não usadas enquanto refatora.
       */
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],

      /**
       * React Refresh:
       * Em libs de UI é comum ter exports extras.
       * Mantemos como warn.
       */
      "react-refresh/only-export-components": "warn",
    },
  },

  // Worker (ambiente server/edge) - mantém as mesmas regras, mas aqui você pode ajustar depois
  {
    files: ["src/worker/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];