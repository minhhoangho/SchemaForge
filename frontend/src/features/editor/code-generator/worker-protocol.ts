import {
  GENERATOR_TARGETS,
  type GeneratedFile,
  type GeneratorDiagnostic,
  type GeneratorOptions,
  type GeneratorTarget,
  type SchemaDocument,
} from "@schemaforge/core";

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

const TARGETS: readonly unknown[] = GENERATOR_TARGETS;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
