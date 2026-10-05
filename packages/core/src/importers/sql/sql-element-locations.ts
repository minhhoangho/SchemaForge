import { toNameKey } from "../../model/name-limits.js";
import { createNameResolver } from "../shared/resolve-references.js";
import type { SourceLocation } from "../shared/import-types.js";
import { toSourceLocation } from "../shared/source-location.js";
import type {
  SqlColumnDefinition,
  SqlTableDefinition,
} from "./sql-column-definitions.js";
import { findAlterTableAction, isNameAt, wordAt } from "./sql-token-reading.js";
import type { SqlStatement } from "./statement-scanner.js";

/**
 * What the scanner read of the statements given to the parser, looked up by
 * name (exact first, then the single case-insensitive match), with the source
 * locations of tables and columns (import / export spec, section 5,
 * "Vị trí của diagnostic theo phần tử").
 */
export type SqlElementLocations = {
  readonly at: (offset: number) => SourceLocation;
  readonly table: (tableName: string) => SourceLocation | null;
  readonly column: (
    tableName: string,
    columnName: string,
  ) => SourceLocation | null;
  readonly tableDefinition: (tableName: string) => SqlTableDefinition | null;
  readonly columnDefinition: (
    tableName: string,
    columnName: string,
  ) => SqlColumnDefinition | null;
};

type AddedColumn = {
  readonly tableName: string;
  readonly columnName: string;
  readonly start: number;
};

// `ALTER TABLE t ADD [COLUMN] c …`, as SQL Server writes an added column.
function readAddedColumn(statement: SqlStatement): AddedColumn | null {
  const { tokens } = statement;
  if (wordAt(tokens, 0) !== "ALTER" || wordAt(tokens, 1) !== "TABLE") {
    return null;
  }
  const action = findAlterTableAction(tokens);
  const nameIndex =
    wordAt(tokens, action.index + 1) === "COLUMN"
      ? action.index + 2
      : action.index + 1;
  const columnName = tokens[nameIndex]?.value;
  return wordAt(tokens, action.index) === "ADD" &&
    isNameAt(tokens, nameIndex) &&
    columnName !== undefined
    ? { tableName: action.tableName, columnName, start: statement.start }
    : null;
}

type NamedList<Element> = {
  readonly elements: readonly Element[];
  readonly find: (wanted: string) => Element | null;
};

function createNamedList<Element>(
  elements: readonly Element[],
  nameOf: (element: Element) => string,
): NamedList<Element> {
  const resolve = createNameResolver(elements.map(nameOf));
  return {
    elements,
    find: (wanted) => {
      const position = resolve(wanted);
      return position === null ? null : (elements[position] ?? null);
    },
  };
}

// Added columns grouped by the name key of their table, each group resolved
// by column name.
function groupAddedColumns(
  statements: readonly SqlStatement[],
): ReadonlyMap<string, NamedList<AddedColumn>> {
  const groups = new Map<string, AddedColumn[]>();
  statements.forEach((statement) => {
    const added = readAddedColumn(statement);
    if (added !== null) {
      const key = toNameKey(added.tableName);
      const group = groups.get(key) ?? [];
      group.push(added);
      groups.set(key, group);
    }
  });
  return new Map(
    [...groups].map(([key, columns]) => [
      key,
      createNamedList(columns, ({ columnName }) => columnName),
    ]),
  );
}

export function locateSqlElements(input: {
  readonly statements: readonly SqlStatement[];
  // What readSqlTableDefinition read of the statements.
  readonly tableDefinitions: readonly SqlTableDefinition[];
  readonly lineStarts: readonly number[];
}): SqlElementLocations {
  const tables = createNamedList(
    input.tableDefinitions,
    ({ tableName }) => tableName,
  );
  const columnLists = new Map(
    tables.elements.map((definition) => [
      definition,
      createNamedList(definition.columns, ({ name }) => name),
    ]),
  );
  const addedColumns = groupAddedColumns(input.statements);
  const at = (offset: number): SourceLocation =>
    toSourceLocation(input.lineStarts, offset);
  const columnDefinition = (
    tableName: string,
    columnName: string,
  ): SqlColumnDefinition | null => {
    const definition = tables.find(tableName);
    return definition === null
      ? null
      : (columnLists.get(definition)?.find(columnName) ?? null);
  };
  const table = (tableName: string): SourceLocation | null => {
    const definition = tables.find(tableName);
    return definition === null ? null : at(definition.start);
  };
  const column = (
    tableName: string,
    columnName: string,
  ): SourceLocation | null => {
    const start =
      columnDefinition(tableName, columnName)?.start ??
      addedColumns.get(toNameKey(tableName))?.find(columnName)?.start;
    return start === undefined ? table(tableName) : at(start);
  };
  return {
    at,
    table,
    column,
    tableDefinition: tables.find,
    columnDefinition,
  };
}
