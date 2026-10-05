import type {
  GeneratedFile,
  GeneratorOptions,
  GeneratorTarget,
  OutputLanguage,
} from "@schemaforge/core";

// Same shape as `GeneratorRequest` in features/editor/code-generator; declared
// here because features must not be imported from `lib/`.
export type DownloadGeneratorRequest = {
  readonly target: GeneratorTarget;
  readonly options: GeneratorOptions[GeneratorTarget];
};

// Spec section 9, "Cơ chế tải".
export const DOWNLOAD_MIME_TYPES = {
  sql: "text/plain;charset=utf-8",
  prisma: "text/plain;charset=utf-8",
  typescript: "text/plain;charset=utf-8",
  dbml: "text/plain;charset=utf-8",
  json: "application/json",
  markdown: "text/markdown;charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  zip: "application/zip",
} as const;

export function toMimeType(language: OutputLanguage): string {
  return DOWNLOAD_MIME_TYPES[language];
}

function stringOption(
  options: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

// Core's option schemas always set these, so a missing one is a programming
// error; a silent fallback would produce a name the spec does not define.
function requiredOption(
  options: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = stringOption(options, key);
  if (value === undefined) {
    throw new Error(`Generator option "${key}" is required for the file name`);
  }
  return value;
}

// The option, when it names the output, goes between the base name and the
// extension so every combination in a ZIP has its own name (spec section 9).
function nameParts(request: DownloadGeneratorRequest): readonly string[] {
  const { target } = request;
  const options: Readonly<Record<string, unknown>> = request.options;
  switch (target) {
    case "postgresql":
    case "mysql":
    case "sqlserver":
    case "openapi":
      return [target];
    case "prisma":
      return [requiredOption(options, "provider")];
    case "drizzle":
      return ["drizzle", requiredOption(options, "dialect")];
    case "typescript":
      return ["types"];
    case "zod":
      return ["schemas"];
    case "mock-api":
      return ["handlers"];
    case "seed": {
      const format = stringOption(options, "format");
      return format === undefined || format === "json"
        ? ["seed"]
        : ["seed", format];
    }
    case "dbml":
    case "markdown":
      return [];
    default: {
      const unreachable: never = target;
      return unreachable;
    }
  }
}

function extensionOf(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf(".") + 1);
}

export function toGeneratedFileName(
  baseName: string,
  request: DownloadGeneratorRequest,
  file: GeneratedFile,
): string {
  return [baseName, ...nameParts(request), extensionOf(file.fileName)].join(
    ".",
  );
}

export function toSchemaJsonFileName(baseName: string): string {
  return `${baseName}.schemaforge.json`;
}

export function toImageFileName(
  baseName: string,
  format: "png" | "svg",
): string {
  return `${baseName}.${format}`;
}

export function toZipFileName(baseName: string): string {
  return `${baseName}.zip`;
}
