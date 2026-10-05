// The only module that imports @dbml/core (import / export spec, section 1). Its model
// types are loose (`any`) and cyclic, so the parse result is read as `unknown` and
// narrowed into the small readonly CoreDatabase of dbml-core-adapter-types.ts; the
// behavior it relies on is pinned by dbml-core-adapter.probe.test.ts.
import { Parser } from "@dbml/core";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { err, ok } from "../../result.js";
import type {
  CoreCheck,
  CoreDatabase,
  CoreDefaultValue,
  CoreEndpoint,
  CoreEnum,
  CoreField,
  CoreIndex,
  CoreParseResult,
  CoreRef,
  CoreTable,
  CoreTableGroup,
  CoreToken,
} from "./dbml-core-adapter-types.js";
import {
  createImportDiagnostic,
  finalizeImportDiagnostics,
} from "./import-diagnostics.js";
import type { ImportDiagnostic, SourceLocation } from "./import-types.js";
import { fromParserPosition } from "./source-location.js";

type ColumnBase = 0 | 1;

const SQL_PARSE_FORMATS = {
  postgresql: "postgres",
  mysql: "mysql",
  sqlserver: "mssql",
} as const satisfies Record<SqlDialect, string>;

// Probe point 1: the SQL (ANTLR) parsers count columns from 0, @dbml/parse from 1.
const SQL_COLUMN_BASE = 0;
const DBML_COLUMN_BASE = 1;

const DEFAULT_VALUE_TYPES: readonly CoreDefaultValue["type"][] = [
  "string",
  "number",
  "boolean",
  "expression",
];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function readProperty(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function readString(value: unknown, key: string): string | null {
  const property = readProperty(value, key);
  return typeof property === "string" ? property : null;
}

function readNumber(value: unknown, key: string): number | null {
  const property = readProperty(value, key);
  return typeof property === "number" && Number.isFinite(property)
    ? property
    : null;
}

function readList(value: unknown, key: string): readonly unknown[] {
  const property = readProperty(value, key);
  return Array.isArray(property) ? property : [];
}

function readFlag(value: unknown, key: string): boolean {
  return readProperty(value, key) === true;
}

function readPosition(
  value: unknown,
  columnBase: ColumnBase,
): SourceLocation | null {
  const line = readNumber(value, "line");
  const column = readNumber(value, "column");
  return line === null || column === null
    ? null
    : fromParserPosition(line, column, columnBase);
}

function readToken(element: unknown, columnBase: ColumnBase): CoreToken | null {
  const token = readProperty(element, "token");
  const start = readPosition(readProperty(token, "start"), columnBase);
  const end = readPosition(readProperty(token, "end"), columnBase);
  return start === null || end === null ? null : { start, end };
}

function readDefaultValue(field: unknown): CoreDefaultValue | null {
  const dbdefault = readProperty(field, "dbdefault");
  const value = readProperty(dbdefault, "value");
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const type = DEFAULT_VALUE_TYPES.find(
    (known) => known === readProperty(dbdefault, "type"),
  );
  // An unknown kind stays visible as an expression so the importer reports it.
  return { type: type ?? "expression", value: String(value) };
}

function readChecks(
  element: unknown,
  columnBase: ColumnBase,
): readonly CoreCheck[] {
  return readList(element, "checks").map((check) => ({
    name: readString(check, "name"),
    expression: readString(check, "expression") ?? "",
    token: readToken(check, columnBase),
  }));
}

function readField(field: unknown, columnBase: ColumnBase): CoreField {
  return {
    name: readString(field, "name") ?? "",
    typeName: readString(readProperty(field, "type"), "type_name") ?? "",
    isPrimaryKey: readFlag(field, "pk"),
    isUnique: readFlag(field, "unique"),
    isNotNull: readFlag(field, "not_null"),
    isIncrement: readFlag(field, "increment"),
    defaultValue: readDefaultValue(field),
    note: readString(field, "note"),
    checks: readChecks(field, columnBase),
    token: readToken(field, columnBase),
  };
}

function readIndex(index: unknown, columnBase: ColumnBase): CoreIndex {
  return {
    name: readString(index, "name"),
    // Probe point 5: column references are "column" or "string", expressions "expression".
    columns: readList(index, "columns").map((column) => ({
      value: readString(column, "value") ?? "",
      isExpression: readString(column, "type") === "expression",
    })),
    isUnique: readFlag(index, "unique"),
    isPrimaryKey: readFlag(index, "pk"),
    type: readString(index, "type"),
    note: readString(index, "note"),
    token: readToken(index, columnBase),
  };
}

function readTable(table: unknown, columnBase: ColumnBase): CoreTable {
  return {
    name: readString(table, "name") ?? "",
    schemaName: readString(readProperty(table, "schema"), "name"),
    note: readString(table, "note"),
    headerColor: readString(table, "headerColor"),
    fields: readList(table, "fields").map((field) =>
      readField(field, columnBase),
    ),
    indexes: readList(table, "indexes").map((index) =>
      readIndex(index, columnBase),
    ),
    checks: readChecks(table, columnBase),
    token: readToken(table, columnBase),
  };
}

// Cardinalities look like "1", "*", "0..1" or "1..*"; only the upper bound matters.
function readEndpoint(endpoint: unknown): CoreEndpoint {
  return {
    schemaName: readString(endpoint, "schemaName"),
    tableName: readString(endpoint, "tableName") ?? "",
    columnNames: readList(endpoint, "fieldNames").filter(
      (name) => typeof name === "string",
    ),
    relation:
      readString(endpoint, "relation")?.endsWith("*") === true ? "*" : "1",
  };
}

function readRef(ref: unknown, columnBase: ColumnBase): CoreRef {
  return {
    name: readString(ref, "name"),
    color: readString(ref, "color"),
    endpoints: readList(ref, "endpoints").map(readEndpoint),
    onDelete: readString(ref, "onDelete"),
    onUpdate: readString(ref, "onUpdate"),
    token: readToken(ref, columnBase),
  };
}

function readEnum(enumElement: unknown, columnBase: ColumnBase): CoreEnum {
  return {
    name: readString(enumElement, "name") ?? "",
    values: readList(enumElement, "values").map((value) => ({
      name: readString(value, "name") ?? "",
      note: readString(value, "note"),
    })),
    token: readToken(enumElement, columnBase),
  };
}

function readTableGroup(
  group: unknown,
  columnBase: ColumnBase,
): CoreTableGroup {
  return {
    name: readString(group, "name") ?? "",
    tableNames: readList(group, "tables").map(
      (table) => readString(table, "name") ?? "",
    ),
    note: readString(group, "note"),
    color: readString(group, "color"),
    token: readToken(group, columnBase),
  };
}

// Probe point 10: schemas are listed one after another, but element ids follow the source.
function readSchemaElements(
  database: unknown,
  key: string,
): readonly unknown[] {
  return readList(database, "schemas")
    .flatMap((schema) => readList(schema, key))
    .toSorted(
      (a, b) => (readNumber(a, "id") ?? 0) - (readNumber(b, "id") ?? 0),
    );
}

function readDatabase(database: unknown, columnBase: ColumnBase): CoreDatabase {
  const [firstRecords] = readList(database, "records");
  return {
    project: {
      name: readString(database, "name"),
      databaseType: readString(database, "databaseType"),
      note: readString(database, "note"),
    },
    tables: readSchemaElements(database, "tables").map((table) =>
      readTable(table, columnBase),
    ),
    refs: readSchemaElements(database, "refs").map((ref) =>
      readRef(ref, columnBase),
    ),
    enums: readSchemaElements(database, "enums").map((item) =>
      readEnum(item, columnBase),
    ),
    tableGroups: readSchemaElements(database, "tableGroups").map((group) =>
      readTableGroup(group, columnBase),
    ),
    notes: readList(database, "notes").map((note) => ({
      content: readString(note, "content") ?? "",
      token: readToken(note, columnBase),
    })),
    records:
      firstRecords === undefined
        ? null
        : { token: readToken(firstRecords, columnBase) },
  };
}

/**
 * Turns whatever the parser threw into diagnostics: one syntax-error per entry of a
 * `diags` list (an entry without a usable position has no location), otherwise a
 * single parse-failed without location.
 */
export function toParseFailureDiagnostics(
  thrown: unknown,
  columnBase: ColumnBase,
): readonly ImportDiagnostic[] {
  const diags = readList(thrown, "diags");
  if (diags.length === 0) {
    return [createImportDiagnostic("parse-failed", null, null)];
  }
  return finalizeImportDiagnostics(
    diags.map((diag) =>
      createImportDiagnostic(
        "syntax-error",
        readPosition(
          readProperty(readProperty(diag, "location"), "start"),
          columnBase,
        ),
        null,
      ),
    ),
  );
}

function parseWithDbmlCore(
  source: string,
  format: "postgres" | "mysql" | "mssql" | "dbmlv2",
  columnBase: ColumnBase,
): CoreParseResult<CoreDatabase> {
  try {
    const database: unknown = Parser.parse(source, format);
    return ok(readDatabase(database, columnBase));
  } catch (error: unknown) {
    // The parser throws plain objects, Errors and RangeError alike; importers never throw.
    return err(toParseFailureDiagnostics(error, columnBase));
  }
}

export function parseSqlWithDbmlCore(
  source: string,
  dialect: SqlDialect,
): CoreParseResult<CoreDatabase> {
  return parseWithDbmlCore(source, SQL_PARSE_FORMATS[dialect], SQL_COLUMN_BASE);
}

export function parseDbmlWithDbmlCore(
  source: string,
): CoreParseResult<CoreDatabase> {
  return parseWithDbmlCore(source, "dbmlv2", DBML_COLUMN_BASE);
}
