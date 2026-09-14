import { builtinModules } from "node:module";

import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import nextPlugin from "@next/eslint-plugin-next";
import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier/flat";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const NO_ENUM = {
  selector: "TSEnumDeclaration",
  message:
    "Use a string literal union or an `as const` object instead of `enum`.",
};

const NO_DANGEROUS_HTML = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message:
    "Do not use dangerouslySetInnerHTML (see .claude/rules/security.md).",
};

const CORE_BOUNDARY =
  "packages/core must stay framework-free and isomorphic (see .claude/rules/core.md).";

const CORE_FORBIDDEN_GLOBALS = [
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "navigator",
  "fetch",
  "process",
  "Buffer",
  "setTimeout",
  "setInterval",
];

export default defineConfig([
  globalIgnores(["**/dist/", "**/.next/", "**/coverage/", "**/next-env.d.ts"]),
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      comments.recommended,
      importX.flatConfigs.typescript,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver()],
    },
    rules: {
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "typeLike", format: ["PascalCase"] },
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: { regex: "^I[A-Z]", match: false },
        },
        {
          selector: "typeAlias",
          format: ["PascalCase"],
          custom: { regex: "^T[A-Z]", match: false },
        },
        { selector: "variable", modifiers: ["destructured"], format: null },
        {
          selector: [
            "variable",
            "parameter",
            "parameterProperty",
            "classProperty",
            "typeProperty",
          ],
          types: ["boolean"],
          format: ["PascalCase"],
          prefix: ["is", "has", "can", "should"],
        },
      ],
      "@eslint-community/eslint-comments/require-description": "error",
      "import-x/no-cycle": "error",
      "import-x/no-default-export": "error",
      "import-x/no-relative-packages": "error",
      "max-depth": ["error", 3],
      "no-console": "error",
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read env only in frontend/src/lib/env.ts or backend/src/config/.",
        },
      ],
      "no-restricted-syntax": ["error", NO_ENUM],
    },
  },
  {
    files: [
      "frontend/src/app/**/{page,layout,loading,error,not-found}.tsx",
      "**/*.config.ts",
    ],
    rules: { "import-x/no-default-export": "off" },
  },
  {
    files: ["frontend/src/lib/env.ts", "backend/src/config/**/*.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "react",
            "react-dom",
            "next",
            "prisma",
            ...builtinModules,
          ].map((name) => ({
            name,
            message: CORE_BOUNDARY,
          })),
          patterns: [
            {
              group: [
                "react/*",
                "react-dom/*",
                "next/*",
                "@nestjs/*",
                "@prisma/*",
                "node:*",
              ],
              message: CORE_BOUNDARY,
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        ...CORE_FORBIDDEN_GLOBALS.map((name) => ({
          name,
          message: CORE_BOUNDARY,
        })),
      ],
    },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    rules: {
      ...Object.fromEntries(
        Object.keys(nextPlugin.configs["core-web-vitals"].rules).map((rule) => [
          rule,
          "error",
        ]),
      ),
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      "no-restricted-syntax": ["error", NO_ENUM, NO_DANGEROUS_HTML],
    },
  },
  {
    files: ["backend/**/*.ts"],
    rules: {
      "@typescript-eslint/no-extraneous-class": [
        "error",
        { allowWithDecorator: true },
      ],
    },
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    plugins: { vitest },
    rules: {
      "vitest/no-disabled-tests": "error",
      "vitest/no-focused-tests": "error",
    },
  },
  prettier,
]);
