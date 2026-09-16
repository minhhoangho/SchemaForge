import { builtinModules } from "node:module";

import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import nextPlugin from "@next/eslint-plugin-next";
import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier/flat";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import i18next from "eslint-plugin-i18next";
import { importX } from "eslint-plugin-import-x";
import jsxA11yX from "eslint-plugin-jsx-a11y-x";
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

// Rule options in a later config block replace those of an earlier block, so
// every block that sets no-restricted-properties must repeat this entry.
const PROCESS_ENV_RESTRICTION = {
  object: "process",
  property: "env",
  message: "Read env only in frontend/src/lib/env.ts or backend/src/config/.",
};

// These boolean names are fixed by the DOM, Radix, and React Flow APIs.
const EXTERNAL_BOOLEAN_NAMES =
  "^(asChild|checked|defaultChecked|defaultOpen|disabled|hidden|inset|modal|open|readOnly|required|selected|dragging|draggable|selectable|deletable|connectable|focusable|animated)$";

const UPPER_SNAKE_CASE_NAME = "^[A-Z0-9_]+$";

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

const FRONTEND_TEST_FILES = [
  "frontend/src/**/*.test.{ts,tsx}",
  "frontend/src/testing/**",
];

// Full-match patterns for JSX attributes whose values users never see.
// Never add aria-label, aria-description, aria-roledescription,
// aria-valuetext, title, placeholder, alt, or label: they are user-facing.
const NON_VISIBLE_JSX_ATTRIBUTES = [
  "className",
  // CSS values on components; the rule already skips style on DOM elements.
  "style",
  "id",
  "key",
  "type",
  "role",
  "name",
  "href",
  "src",
  "rel",
  "target",
  "htmlFor",
  "lang",
  "dir",
  "autoComplete",
  "inputMode",
  "value",
  // Tokens of Tabs, Select, and RadioGroup.
  "defaultValue",
  "orientation",
  "data-.*",
  "aria-(activedescendant|atomic|busy|checked|controls|current|describedby|details|disabled|errormessage|expanded|flowto|haspopup|hidden|invalid|labelledby|live|modal|multiline|multiselectable|orientation|owns|pressed|readonly|relevant|required|selected|sort)",
  // SVG attributes.
  "d",
  "viewBox",
  "fill",
  "stroke",
  "strokeWidth",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeDasharray",
  "markerEnd",
  "markerStart",
  "markerWidth",
  "markerHeight",
  "markerUnits",
  "refX",
  "refY",
  "orient",
  "points",
  "transform",
  "xmlns",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  // shadcn/ui props.
  "variant",
  "size",
  "side",
  "align",
];

const NO_NETWORK =
  "The editor is local-first and makes no network calls (see document/specs/2026-09-14-editor-mvp-design.md, section 11). Part 4 opens network APIs only for src/lib/api/.";

const NETWORK_GLOBALS = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"];

const NETWORK_PROPERTIES = [
  ["navigator", "sendBeacon"],
  ["window", "fetch"],
  ["globalThis", "fetch"],
];

const TEST_ONLY_IMPORT =
  "src/testing/ and @schemaforge/core/testing are only for test files.";

const FEATURE_BOUNDARY =
  "features/schema-list and features/editor must not import each other; move shared code to src/lib/.";

function frontendImportRestrictions({ canImportToast, forbiddenFeature }) {
  return {
    paths: [
      { name: "@schemaforge/core/testing", message: TEST_ONLY_IMPORT },
      ...(canImportToast
        ? []
        : [
            {
              name: "sonner",
              importNames: ["toast"],
              message: "Show toasts through notify() in src/lib/notify.ts",
            },
          ]),
    ],
    patterns: [
      { group: ["@/testing/*", "**/testing/*"], message: TEST_ONLY_IMPORT },
      ...(forbiddenFeature === undefined
        ? []
        : [
            {
              group: [
                `@/features/${forbiddenFeature}/*`,
                `**/features/${forbiddenFeature}/*`,
              ],
              message: FEATURE_BOUNDARY,
            },
          ]),
    ],
  };
}

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
          selector: "variable",
          modifiers: ["const"],
          types: ["boolean"],
          format: ["UPPER_CASE"],
          prefix: ["IS_", "HAS_", "CAN_", "SHOULD_"],
          filter: { regex: UPPER_SNAKE_CASE_NAME, match: true },
        },
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
          filter: { regex: EXTERNAL_BOOLEAN_NAMES, match: false },
        },
      ],
      "@eslint-community/eslint-comments/require-description": "error",
      "import-x/no-cycle": "error",
      "import-x/no-default-export": "error",
      "import-x/no-relative-packages": "error",
      "max-depth": ["error", 3],
      "no-console": "error",
      "no-restricted-properties": ["error", PROCESS_ENV_RESTRICTION],
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
    // CustomTypeOptions is extended through declaration merging, so it must be
    // an interface.
    files: ["frontend/src/lib/i18n/i18next.d.ts"],
    rules: { "@typescript-eslint/consistent-type-definitions": "off" },
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
    files: ["frontend/src/**/*.tsx"],
    ignores: FRONTEND_TEST_FILES,
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          framework: "react",
          mode: "jsx-only",
          "jsx-attributes": { exclude: NON_VISIBLE_JSX_ATTRIBUTES },
        },
      ],
    },
  },
  {
    files: ["frontend/src/**/*.tsx"],
    extends: [jsxA11yX.configs.recommended],
    settings: {
      "jsx-a11y-x": {
        components: {
          Button: "button",
          Input: "input",
          Label: "label",
          Textarea: "textarea",
        },
      },
    },
  },
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...NETWORK_GLOBALS.map((name) => ({ name, message: NO_NETWORK })),
      ],
      "no-restricted-properties": [
        "error",
        PROCESS_ENV_RESTRICTION,
        ...NETWORK_PROPERTIES.map(([object, property]) => ({
          object,
          property,
          message: NO_NETWORK,
        })),
      ],
    },
  },
  {
    // Must stay after every block that sets no-restricted-properties.
    files: ["frontend/src/lib/env.ts", "backend/src/config/**/*.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    ignores: [...FRONTEND_TEST_FILES, "frontend/src/lib/notify.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        frontendImportRestrictions({ canImportToast: false }),
      ],
    },
  },
  {
    files: ["frontend/src/lib/notify.ts"],
    ignores: FRONTEND_TEST_FILES,
    rules: {
      "no-restricted-imports": [
        "error",
        frontendImportRestrictions({ canImportToast: true }),
      ],
    },
  },
  // The feature blocks come after the general block because their options
  // replace its options.
  {
    files: ["frontend/src/features/schema-list/**"],
    ignores: FRONTEND_TEST_FILES,
    rules: {
      "no-restricted-imports": [
        "error",
        frontendImportRestrictions({
          canImportToast: false,
          forbiddenFeature: "editor",
        }),
      ],
    },
  },
  {
    files: ["frontend/src/features/editor/**"],
    ignores: FRONTEND_TEST_FILES,
    rules: {
      "no-restricted-imports": [
        "error",
        frontendImportRestrictions({
          canImportToast: false,
          forbiddenFeature: "schema-list",
        }),
      ],
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
