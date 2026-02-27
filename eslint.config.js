import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  // 1) Ignorar pastas geradas e arquivos que não fazem sentido lintar
  {
    ignores: ["dist/**", "node_modules/**", ".wrangler/**"],
  },

  // 2) Base JS recomendada
  js.configs.recommended,

  // 3) TypeScript recomendado (flat config)
  ...tseslint.configs.recommended,

  // 4) Configs e scripts de build/dev (ambiente Node)
  {
    files: [
      "eslint.config.js",
      "tailwind.config.{js,cjs,mjs}",
      "postcss.config.{js,cjs,mjs}",
      "vite.config.{ts,js,mjs,cjs}",
      "wrangler.{ts,js,mjs,cjs}",
      "*.config.{ts,js,mjs,cjs}",
      "test-*.mjs",
      "scripts/**/*.{ts,js,mjs,cjs}",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        // Node 20+ tem fetch global, mas o ESLint precisa saber
        fetch: "readonly",
        console: "readonly",
      },
    },
    rules: {
      // Permitir require() em arquivos de config (tailwind costuma usar require)
      "@typescript-eslint/no-require-imports": "off",
      // Se aparecer 'require is not defined' em JS config
      "no-undef": "off",
    },
  },

  // 5) App React/TS (browser)
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
      ...reactHooks.configs.recommended.rules,

      // Para não travar PR agora: vira warning
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],

      // UI libs às vezes exportam mais coisas
      "react-refresh/only-export-components": "warn",
    },
  },

  // 6) Worker (Node/Edge-like)
  {
    files: ["src/worker/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];