import type { DocumentPath } from "../../document-path.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { GeneratorDiagnosticCode } from "./diagnostic-codes.js";

export const GENERATOR_TARGETS = [
  "postgresql",
  "mysql",
  "sqlserver",
  "prisma",
  "drizzle",
  "typescript",
  "zod",
  "mock-api",
  "openapi",
  "seed",
  "dbml",
  "markdown",
] as const;

export type GeneratorTarget = (typeof GENERATOR_TARGETS)[number];

export const SQL_DIALECTS = ["postgresql", "mysql", "sqlserver"] as const;

export type SqlDialect = (typeof SQL_DIALECTS)[number];

export type NoOptions = Readonly<Record<string, never>>;

// Section, column and value labels of the Markdown document (CG-10). ON DELETE
// and ON UPDATE actions are written as SQL keywords, not labels.
export type MarkdownLabels = {
  readonly enumsHeading: string;
  readonly tablesHeading: string;
  readonly indexesHeading: string;
  readonly relationsHeading: string;
  readonly columnNameHeader: string;
  readonly columnTypeHeader: string;
  readonly columnNullableHeader: string;
  readonly columnDefaultHeader: string;
  readonly columnConstraintsHeader: string;
  readonly columnCommentHeader: string;
  readonly indexNameHeader: string;
  readonly indexColumnsHeader: string;
  readonly indexUniqueHeader: string;
  readonly yes: string;
  readonly no: string;
  readonly primaryKey: string;
  readonly unique: string;
  readonly autoIncrement: string;
  readonly foreignKey: string;
  readonly oneToOne: string;
  readonly oneToMany: string;
  readonly outgoingRelations: string;
  readonly incomingRelations: string;
};

export type GeneratorOptions = {
  readonly postgresql: NoOptions;
  readonly mysql: NoOptions;
  readonly sqlserver: NoOptions;
  readonly prisma: { readonly provider: SqlDialect };
  readonly drizzle: { readonly dialect: "postgresql" | "mysql" };
  readonly typescript: NoOptions;
  readonly zod: NoOptions;
  readonly "mock-api": NoOptions;
  readonly openapi: NoOptions;
  readonly seed: {
    readonly format: SqlDialect | "json";
    readonly rowsPerTable: number;
    readonly seed: number;
  };
  readonly dbml: NoOptions;
  readonly markdown: { readonly labels: MarkdownLabels };
};

export type OutputLanguage =
  "sql" | "prisma" | "typescript" | "json" | "dbml" | "markdown";

export type GeneratedFile = {
  readonly fileName: string;
  readonly language: OutputLanguage;
  // Always ends with exactly one "\n" (see renderFileContent).
  readonly content: string;
};

export type GeneratorDiagnostic = {
  readonly code: GeneratorDiagnosticCode;
  readonly path: DocumentPath;
};

export type GenerateResult = {
  readonly file: GeneratedFile;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

export type Generate<T extends GeneratorTarget> = (
  schema: SchemaDocument,
  options: GeneratorOptions[T],
) => GenerateResult;
