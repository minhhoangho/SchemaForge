import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { Column } from "../model/column.js";
import type { ColumnType } from "../model/column-type.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { parseSchemaDocument } from "../parse/parse-schema-document.js";
import {
  PROPERTY_RUNS,
  PROPERTY_SEED,
  schemaDocumentArbitrary,
} from "../testing/arbitraries.js";
import { unwrapOk } from "../testing/unwrap-result.js";
import { generateMysql } from "./mysql/index.js";
import { generatePostgresql } from "./postgresql/index.js";
import { generateSeed } from "./seed/index.js";
import type { GenerateResult, SqlDialect } from "./shared/generator-types.js";
import { generateSqlServer } from "./sqlserver/index.js";

const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };
const PROPERTY_TIMEOUT_MS = 60_000;
const SEED_OPTIONS = { rowsPerTable: 3, seed: 1 };

// Every user text starts with this marker, which no generator writes itself.
const MARKER = "§";
const HOSTILE_UNITS = [
  '"',
  "'",
  "`",
  "[",
  "]",
  "\\",
  "*/",
  "/*",
  "--",
  ";",
  "\n",
  "\r",
  "\u0000",
  "a",
  "é",
];

// One alternation per dialect, so the scan runs left to right and a quote
// character inside a string never opens an identifier, and the reverse.
const QUOTED_PATTERNS: Readonly<Record<SqlDialect, RegExp>> = {
  postgresql: /"(?:[^"]|"")*"|'(?:[^']|'')*'/g,
  mysql: /`(?:[^`]|``)*`|'(?:[^'\\]|''|\\[\s\S])*'/g,
  sqlserver: /\[(?:[^\]]|\]\])*\]|N'(?:[^']|'')*'/g,
};

type SqlCase = {
  readonly name: string;
  readonly dialect: SqlDialect;
  readonly run: (schema: SchemaDocument) => GenerateResult;
};

const SQL_CASES: readonly SqlCase[] = [
  {
    name: "postgresql",
    dialect: "postgresql",
    run: (schema) => generatePostgresql(schema, {}),
  },
  {
    name: "mysql",
    dialect: "mysql",
    run: (schema) => generateMysql(schema, {}),
  },
  {
    name: "sqlserver",
    dialect: "sqlserver",
    run: (schema) => generateSqlServer(schema, {}),
  },
  ...(["postgresql", "mysql", "sqlserver"] as const).map((dialect) => ({
    name: `seed ${dialect}`,
    dialect,
    run: (schema: SchemaDocument) =>
      generateSeed(schema, { format: dialect, ...SEED_OPTIONS }),
  })),
];

function hostileTextArbitrary(): fc.Arbitrary<string> {
  return fc
    .string({ unit: fc.constantFrom(...HOSTILE_UNITS) })
    .map((text) => `${MARKER}${text}`);
}

function hostileTextsArbitrary(): fc.Arbitrary<readonly string[]> {
  return fc.array(hostileTextArbitrary(), { minLength: 1, maxLength: 8 });
}

// Hands out the texts in turn, starting over after the last one.
function createTextPicker(texts: readonly string[]): () => string {
  let next = 0;
  return () => {
    const text = texts[next % texts.length] ?? MARKER;
    next += 1;
    return text;
  };
}

function mapValues<Value>(
  map: Readonly<Record<string, Value>>,
  transform: (value: Value) => Value,
): Readonly<Record<string, Value>> {
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => [key, transform(value)]),
  );
}

// A JSON round trip and parseSchemaDocument keep the document well-formed.
function reparse(document: unknown): SchemaDocument {
  return unwrapOk(parseSchemaDocument(JSON.parse(JSON.stringify(document))));
}

function withHostileColumnTexts(column: Column, pick: () => string): Column {
  const { defaultValue, type } = column;
  return {
    ...column,
    name: pick(),
    comment: pick(),
    defaultValue:
      defaultValue?.kind === "literal"
        ? { kind: "literal", value: pick() }
        : defaultValue,
    type: type.kind === "custom" ? { kind: "custom", name: pick() } : type,
  };
}

/** Replaces every name, comment, enum value, default literal and custom type name. */
function withHostileTexts(
  schema: SchemaDocument,
  texts: readonly string[],
): SchemaDocument {
  const pick = createTextPicker(texts);
  return reparse({
    ...schema,
    name: pick(),
    tables: mapValues(schema.tables, (table) => ({
      ...table,
      name: pick(),
      comment: pick(),
    })),
    columns: mapValues(schema.columns, (column) =>
      withHostileColumnTexts(column, pick),
    ),
    indexes: mapValues(schema.indexes, (index) => ({ ...index, name: pick() })),
    enums: mapValues(schema.enums, (element) => ({
      ...element,
      name: pick(),
      values: element.values.map(() => pick()),
    })),
    subjectAreas: mapValues(schema.subjectAreas, (area) => ({
      ...area,
      name: pick(),
    })),
  });
}

/** Gives every column a custom type whose name is hostile text. */
function withHostileCustomTypes(
  schema: SchemaDocument,
  texts: readonly string[],
): SchemaDocument {
  const pick = createTextPicker(texts);
  return reparse({
    ...schema,
    columns: mapValues(schema.columns, (column) => {
      const type: ColumnType = { kind: "custom", name: pick() };
      return { ...column, type };
    }),
  });
}

function stripQuoted(content: string, dialect: SqlDialect): string {
  return content.replaceAll(QUOTED_PATTERNS[dialect], "");
}

describe.each(SQL_CASES)("$name output safety", ({ dialect, run }) => {
  it(
    "leaves no user text outside quoted identifiers and strings",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(
          schemaDocumentArbitrary(),
          hostileTextsArbitrary(),
          (schema, texts) => {
            const { content } = run(withHostileTexts(schema, texts)).file;

            expect(stripQuoted(content, dialect)).not.toContain(MARKER);
          },
        ),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "writes no unsafe custom type name outside a string",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(
          schemaDocumentArbitrary(),
          hostileTextsArbitrary(),
          (schema, texts) => {
            const { content } = run(withHostileCustomTypes(schema, texts)).file;

            expect(stripQuoted(content, dialect)).not.toContain(MARKER);
          },
        ),
        PROPERTY_PARAMETERS,
      );
    },
  );
});
