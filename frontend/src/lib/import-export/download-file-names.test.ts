import type { GeneratedFile, MarkdownLabels } from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import type { DownloadGeneratorRequest } from "./download-file-names";
import {
  DOWNLOAD_MIME_TYPES,
  toGeneratedFileName,
  toImageFileName,
  toMimeType,
  toSchemaJsonFileName,
  toZipFileName,
} from "./download-file-names";

function file(fileName: string): GeneratedFile {
  return { fileName, language: "sql", content: "" };
}

const LABELS: MarkdownLabels = {
  enumsHeading: "enumsHeading",
  tablesHeading: "tablesHeading",
  indexesHeading: "indexesHeading",
  relationsHeading: "relationsHeading",
  columnNameHeader: "columnNameHeader",
  columnTypeHeader: "columnTypeHeader",
  columnNullableHeader: "columnNullableHeader",
  columnDefaultHeader: "columnDefaultHeader",
  columnConstraintsHeader: "columnConstraintsHeader",
  columnCommentHeader: "columnCommentHeader",
  indexNameHeader: "indexNameHeader",
  indexColumnsHeader: "indexColumnsHeader",
  indexUniqueHeader: "indexUniqueHeader",
  yes: "yes",
  no: "no",
  primaryKey: "primaryKey",
  unique: "unique",
  autoIncrement: "autoIncrement",
  foreignKey: "foreignKey",
  oneToOne: "oneToOne",
  oneToMany: "oneToMany",
  outgoingRelations: "outgoingRelations",
  incomingRelations: "incomingRelations",
};

const SEED = { rowsPerTable: 10, seed: 1 };

const SPEC_TABLE: readonly [DownloadGeneratorRequest, string, string][] = [
  [{ target: "postgresql", options: {} }, "schema.sql", "blog.postgresql.sql"],
  [{ target: "mysql", options: {} }, "schema.sql", "blog.mysql.sql"],
  [{ target: "sqlserver", options: {} }, "schema.sql", "blog.sqlserver.sql"],
  [
    { target: "prisma", options: { provider: "postgresql" } },
    "schema.prisma",
    "blog.postgresql.prisma",
  ],
  [
    { target: "prisma", options: { provider: "mysql" } },
    "schema.prisma",
    "blog.mysql.prisma",
  ],
  [
    { target: "prisma", options: { provider: "sqlserver" } },
    "schema.prisma",
    "blog.sqlserver.prisma",
  ],
  [
    { target: "drizzle", options: { dialect: "postgresql" } },
    "schema.ts",
    "blog.drizzle.postgresql.ts",
  ],
  [
    { target: "drizzle", options: { dialect: "mysql" } },
    "schema.ts",
    "blog.drizzle.mysql.ts",
  ],
  [{ target: "typescript", options: {} }, "types.ts", "blog.types.ts"],
  [{ target: "zod", options: {} }, "schemas.ts", "blog.schemas.ts"],
  [{ target: "mock-api", options: {} }, "handlers.ts", "blog.handlers.ts"],
  [{ target: "openapi", options: {} }, "openapi.json", "blog.openapi.json"],
  [
    { target: "seed", options: { ...SEED, format: "postgresql" } },
    "seed.sql",
    "blog.seed.postgresql.sql",
  ],
  [
    { target: "seed", options: { ...SEED, format: "mysql" } },
    "seed.sql",
    "blog.seed.mysql.sql",
  ],
  [
    { target: "seed", options: { ...SEED, format: "sqlserver" } },
    "seed.sql",
    "blog.seed.sqlserver.sql",
  ],
  [
    { target: "seed", options: { ...SEED, format: "json" } },
    "seed.json",
    "blog.seed.json",
  ],
  [{ target: "dbml", options: {} }, "schema.dbml", "blog.dbml"],
];

describe("download file names", () => {
  it.each(SPEC_TABLE)(
    "names every generator output as in the spec table (%j)",
    (request, generatedName, expected) => {
      expect(toGeneratedFileName("blog", request, file(generatedName))).toBe(
        expected,
      );
    },
  );

  it("names markdown output", () => {
    const request = {
      target: "markdown",
      options: { labels: LABELS },
    } satisfies DownloadGeneratorRequest;

    expect(toGeneratedFileName("blog", request, file("schema.md"))).toBe(
      "blog.md",
    );
  });

  it("uses the extension of the generated file", () => {
    expect(
      toGeneratedFileName(
        "blog",
        { target: "openapi", options: {} },
        file("openapi.yaml"),
      ),
    ).toBe("blog.openapi.yaml");
  });

  it("names json, image and zip files", () => {
    expect(toSchemaJsonFileName("blog")).toBe("blog.schemaforge.json");
    expect(toImageFileName("blog", "png")).toBe("blog.png");
    expect(toImageFileName("blog", "svg")).toBe("blog.svg");
    expect(toZipFileName("blog")).toBe("blog.zip");
  });

  it("maps each output language to its mime type", () => {
    expect(toMimeType("sql")).toBe("text/plain;charset=utf-8");
    expect(toMimeType("prisma")).toBe("text/plain;charset=utf-8");
    expect(toMimeType("typescript")).toBe("text/plain;charset=utf-8");
    expect(toMimeType("dbml")).toBe("text/plain;charset=utf-8");
    expect(toMimeType("json")).toBe("application/json");
    expect(toMimeType("markdown")).toBe("text/markdown;charset=utf-8");
    expect(DOWNLOAD_MIME_TYPES.png).toBe("image/png");
    expect(DOWNLOAD_MIME_TYPES.svg).toBe("image/svg+xml");
    expect(DOWNLOAD_MIME_TYPES.zip).toBe("application/zip");
  });
});
