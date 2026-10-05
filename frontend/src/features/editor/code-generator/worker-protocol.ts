import {
  GENERATOR_TARGETS,
  type GeneratedFile,
  type GeneratorDiagnostic,
  type GeneratorOptions,
  type GeneratorTarget,
  type SchemaDocument,
} from "@schemaforge/core";

import type { GeneratorRequest } from "./generator-request";

// `color` is a `var(--code-…)` reference or null; never an HTML string.
export type CodeToken = {
  readonly content: string;
  readonly color: string | null;
};

export type GenerateCodeRequest<T extends GeneratorTarget = GeneratorTarget> = {
  readonly requestId: number;
  readonly target: T;
  readonly options: GeneratorOptions[T];
  readonly document: SchemaDocument;
};

export type GenerateCodeResponse =
  | {
      readonly requestId: number;
      readonly kind: "ok";
      readonly file: GeneratedFile;
      readonly diagnostics: readonly GeneratorDiagnostic[];
      readonly tokens: readonly (readonly CodeToken[])[] | null;
    }
  | { readonly requestId: number; readonly kind: "failed" };

export type BuildZipRequest = {
  readonly kind: "build-zip";
  readonly requestId: number;
  readonly document: SchemaDocument;
  readonly baseName: string;
  readonly generators: readonly GeneratorRequest[];
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the plan (Task 31) fixes this protocol field name.
  readonly includeJson: boolean;
  readonly images: readonly {
    readonly fileName: string;
    readonly bytes: Uint8Array;
  }[];
};

export type BuildZipResponse =
  | {
      readonly requestId: number;
      readonly kind: "zip";
      readonly bytes: Uint8Array;
      readonly diagnosticCount: number;
    }
  | { readonly requestId: number; readonly kind: "zip-failed" };

const TARGETS: readonly unknown[] = GENERATOR_TARGETS;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGeneratorRequest(value: unknown): boolean {
  return (
    isObject(value) && TARGETS.includes(value.target) && isObject(value.options)
  );
}

function isImage(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.fileName === "string" &&
    value.bytes instanceof Uint8Array
  );
}

export function isBuildZipRequest(value: unknown): value is BuildZipRequest {
  return (
    isObject(value) &&
    value.kind === "build-zip" &&
    Number.isInteger(value.requestId) &&
    isObject(value.document) &&
    typeof value.baseName === "string" &&
    typeof value.includeJson === "boolean" &&
    Array.isArray(value.generators) &&
    value.generators.every(isGeneratorRequest) &&
    Array.isArray(value.images) &&
    value.images.every(isImage)
  );
}

// The document comes from the editor store, which only holds valid documents,
// so it is not parsed again here.
export function isGenerateCodeRequest(
  value: unknown,
): value is GenerateCodeRequest {
  return (
    isObject(value) &&
    Number.isInteger(value.requestId) &&
    TARGETS.includes(value.target) &&
    isObject(value.options) &&
    isObject(value.document)
  );
}
