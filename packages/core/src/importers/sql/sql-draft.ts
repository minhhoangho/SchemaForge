import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { toNameKey } from "../../model/name-limits.js";
import type {
  CoreDatabase,
  CoreTable,
} from "../shared/dbml-core-adapter-types.js";
import type { ImportDraft } from "../shared/import-draft.js";
import type { SourceLocation } from "../shared/import-types.js";
import { createNameResolver } from "../shared/resolve-references.js";
import { readCheckEnumValues } from "./check-to-enum.js";
import type { PostgresqlAlterColumn } from "./postgresql-identity.js";
import type { SqlAddedUniqueConstraint } from "./sql-column-definitions.js";
import { translateColumn } from "./sql-draft-columns.js";
import type { SqlDraftContext, SqlDraftParts } from "./sql-draft-context.js";
import {
  reportIndexesOfMissingTables,
  translateIndexes,
} from "./sql-draft-indexes.js";
import { resolveScannerStatements } from "./sql-draft-overrides.js";
import { translateRefs } from "./sql-draft-relations.js";
import { normalizeParserNames } from "./sql-parser-names.js";
import type { SqlElementLocations } from "./sql-element-locations.js";
import type { SqlIndexDefinition } from "./sql-index-definitions.js";
import type { SqlServerDescription } from "./sqlserver-extended-property.js";
import { tokenizeSql } from "./statement-scanner.js";

export type SqlDraftInput = {
  readonly dialect: SqlDialect;
  readonly database: CoreDatabase;
  readonly locations: SqlElementLocations;
  readonly indexDefinitions: readonly SqlIndexDefinition[];
  readonly addedUniqueConstraints: readonly SqlAddedUniqueConstraint[];
  readonly alterColumns: readonly PostgresqlAlterColumn[];
  readonly descriptions: readonly SqlServerDescription[];
};

// Namespaces that pg_dump and SSMS write for tables of the default schema.
const DEFAULT_NAMESPACES: Readonly<Record<SqlDialect, string | null>> = {
  postgresql: "public",
  mysql: null,
  sqlserver: "dbo",
};

function groupByTable<Element extends { readonly tableName: string }>(
  elements: readonly Element[],
): ReadonlyMap<string, readonly Element[]> {
  const groups = new Map<string, Element[]>();
  elements.forEach((element) => {
    const key = toNameKey(element.tableName);
    const group = groups.get(key) ?? [];
    group.push(element);
    groups.set(key, group);
  });
  return groups;
}

// The first pk index, else the pk columns; CG-01 always names the key
// `<table>_pkey`, so its name is not kept.
function readPrimaryKey(table: CoreTable): readonly string[] {
  const keyIndex = table.indexes.find(({ isPrimaryKey }) => isPrimaryKey);
  return keyIndex === undefined
    ? table.fields
        .filter(({ isPrimaryKey }) => isPrimaryKey)
        .map(({ name }) => name)
    : keyIndex.columns.map(({ value }) => value);
}

// The column a CHECK names first, as `<column> IN (…)` does.
function firstNameOf(expression: string, dialect: SqlDialect): string | null {
  const lexed = tokenizeSql(expression, dialect);
  const token = lexed.isOk
    ? lexed.value.find(
        ({ kind }) => kind === "word" || kind === "quotedIdentifier",
      )
    : undefined;
  return token?.value ?? null;
}

// The enum values of a CHECK on the column at columnIndex; null when it is
// not `<column> IN (…)`.
function readCheckValues(
  table: CoreTable,
  expression: string,
  columnIndex: number | null,
  dialect: SqlDialect,
): readonly string[] | null {
  const columnName =
    columnIndex === null ? undefined : table.fields[columnIndex]?.name;
  return columnName === undefined
    ? null
    : readCheckEnumValues({ expression, columnName, dialect });
}

type CheckSource = {
  readonly expression: string;
  readonly columnIndex: number | null;
  readonly location: SourceLocation | null;
};

// Column checks first, then table checks, whose column is the first name.
function listChecks(
  table: CoreTable,
  context: SqlDraftContext,
): readonly CheckSource[] {
  const resolveColumn = createNameResolver(
    table.fields.map(({ name }) => name),
  );
  return [
    ...table.fields.flatMap((field, columnIndex) =>
      field.checks.map(({ expression }) => ({
        expression,
        columnIndex,
        location: context.locations.column(table.name, field.name),
      })),
    ),
    ...table.checks.map(({ expression }) => {
      const columnName = firstNameOf(expression, context.dialect);
      return {
        expression,
        columnIndex: columnName === null ? null : resolveColumn(columnName),
        location: context.locations.table(table.name),
      };
    }),
  ];
}

/**
 * The enum values of the CHECK constraints of a table by column position; any
 * other CHECK, or a second one on a column, is reported as
 * check-constraint-not-supported.
 */
function readCheckEnums(
  table: CoreTable,
  context: SqlDraftContext,
): ReadonlyMap<number, readonly string[]> {
  const valuesByColumn = new Map<number, readonly string[]>();
  listChecks(table, context).forEach(
    ({ expression, columnIndex, location }) => {
      const values = readCheckValues(
        table,
        expression,
        columnIndex,
        context.dialect,
      );
      if (
        values !== null &&
        columnIndex !== null &&
        !valuesByColumn.has(columnIndex)
      ) {
        valuesByColumn.set(columnIndex, values);
        return;
      }
      context.parts.diagnostics.push({
        code: "check-constraint-not-supported",
        location,
        target: null,
      });
    },
  );
  return valuesByColumn;
}

// The MySQL and SQL Server parsers name the schema of an unqualified table
// "public"; the scanner knows whether the source wrote one.
function reportDroppedNamespace(
  table: CoreTable,
  tableIndex: number,
  location: SourceLocation | null,
  context: SqlDraftContext,
): void {
  const isQualified =
    context.locations.tableDefinition(table.name)?.isQualified ?? true;
  if (
    isQualified &&
    table.schemaName !== null &&
    table.schemaName !== DEFAULT_NAMESPACES[context.dialect]
  ) {
    context.parts.diagnostics.push({
      code: "namespace-dropped",
      location,
      target: { kind: "table", tableIndex },
    });
  }
}

function translateTable(
  table: CoreTable,
  tableIndex: number,
  context: SqlDraftContext,
): void {
  const location = context.locations.table(table.name);
  reportDroppedNamespace(table, tableIndex, location, context);
  const primaryKey = readPrimaryKey(table);
  const primaryKeyKeys = new Set(primaryKey.map(toNameKey));
  const checkEnums = readCheckEnums(table, context);
  const columns = table.fields.map((field, columnIndex) =>
    translateColumn(
      field,
      table,
      { tableIndex, columnIndex },
      {
        isPrimaryKey: primaryKeyKeys.has(toNameKey(field.name)),
        checkValues: checkEnums.get(columnIndex) ?? null,
      },
      context,
    ),
  );
  context.parts.tables.push({
    name: table.name,
    comment: context.overrides.tableComment(tableIndex) ?? table.note ?? "",
    subjectAreaName: null,
    columns: translateIndexes(table, tableIndex, columns, context),
    primaryKeyColumnNames: primaryKey,
    location,
  });
}

function createDraftContext(
  input: SqlDraftInput,
  database: CoreDatabase,
  scanned: ReturnType<typeof resolveScannerStatements>,
): SqlDraftContext {
  const { dialect, locations } = input;
  // MySQL has no CREATE TYPE: every parsed enum is an inline ENUM(…).
  const typeEnums = dialect === "mysql" ? [] : database.enums;
  const parts: SqlDraftParts = {
    tables: [],
    indexes: [],
    enums: typeEnums.map(({ name, values }) => ({
      name,
      values: values.map((value) => value.name),
      location: null,
    })),
    diagnostics: [...scanned.diagnostics],
  };
  return {
    dialect,
    locations,
    enumNameKeys: new Set(typeEnums.map(({ name }) => toNameKey(name))),
    inlineEnumNames: new Set(
      dialect === "mysql" ? database.enums.map(({ name }) => name) : [],
    ),
    overrides: scanned.overrides,
    indexDefinitions: groupByTable(input.indexDefinitions),
    addedUniqueConstraints: groupByTable(input.addedUniqueConstraints),
    parts,
  };
}

/**
 * Translates the parsed database and what the scanner read again into a draft
 * (import / export spec, section 5).
 */
export function buildSqlDraft(input: SqlDraftInput): ImportDraft {
  const { dialect, locations } = input;
  const database = normalizeParserNames(input.database, dialect);
  const scanned = resolveScannerStatements({
    tables: database.tables,
    alterColumns: input.alterColumns,
    descriptions: input.descriptions,
    at: locations.at,
  });
  const context = createDraftContext(input, database, scanned);
  const { parts } = context;
  database.tables.forEach((table, tableIndex) => {
    translateTable(table, tableIndex, context);
  });
  const relationParts = translateRefs({
    refs: database.refs,
    tables: parts.tables,
    indexes: parts.indexes,
    locations,
  });
  return {
    name: null,
    tables: parts.tables,
    indexes: parts.indexes,
    relations: relationParts.relations,
    enums: parts.enums,
    subjectAreas: [],
    notes: [],
    diagnostics: [
      ...parts.diagnostics,
      ...reportIndexesOfMissingTables(database.tables, context),
      ...relationParts.diagnostics,
    ],
  };
}
