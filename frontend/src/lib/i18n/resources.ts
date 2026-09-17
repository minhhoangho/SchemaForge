import type { LocaleNamespace } from "./locale-namespace";
import { enApiErrors } from "./locales/en/api-errors";
import { enAuth } from "./locales/en/auth";
import { enCanvas } from "./locales/en/canvas";
import { enCommon } from "./locales/en/common";
import { enEditor } from "./locales/en/editor";
import { enErrors } from "./locales/en/errors";
import { enIssues } from "./locales/en/issues";
import { enSchemaList } from "./locales/en/schema-list";
import { enStorage } from "./locales/en/storage";
import { enSync } from "./locales/en/sync";
import { viApiErrors } from "./locales/vi/api-errors";
import { viAuth } from "./locales/vi/auth";
import { viCanvas } from "./locales/vi/canvas";
import { viCommon } from "./locales/vi/common";
import { viEditor } from "./locales/vi/editor";
import { viErrors } from "./locales/vi/errors";
import { viIssues } from "./locales/vi/issues";
import { viSchemaList } from "./locales/vi/schema-list";
import { viStorage } from "./locales/vi/storage";
import { viSync } from "./locales/vi/sync";
import type { Locale } from "./supported-locales";

export const NAMESPACES = [
  "common",
  "schemaList",
  "editor",
  "canvas",
  "issues",
  "errors",
  "storage",
  "auth",
  "sync",
  "apiErrors",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE = "common" satisfies Namespace;

export const enResources = {
  common: enCommon,
  schemaList: enSchemaList,
  editor: enEditor,
  canvas: enCanvas,
  issues: enIssues,
  errors: enErrors,
  storage: enStorage,
  auth: enAuth,
  sync: enSync,
  apiErrors: enApiErrors,
} as const;

export const viResources = {
  common: viCommon,
  schemaList: viSchemaList,
  editor: viEditor,
  canvas: viCanvas,
  issues: viIssues,
  errors: viErrors,
  storage: viStorage,
  auth: viAuth,
  sync: viSync,
  apiErrors: viApiErrors,
} as const satisfies LocaleNamespace<typeof enResources>;

export const RESOURCES = {
  en: enResources,
  vi: viResources,
} satisfies Record<Locale, LocaleNamespace<typeof enResources>>;
