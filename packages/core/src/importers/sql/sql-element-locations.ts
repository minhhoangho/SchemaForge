import { toNameKey } from "../../model/name-limits.js";
import { createNameResolver } from "../shared/resolve-references.js";
import type { SourceLocation } from "../shared/import-types.js";
import { toSourceLocation } from "../shared/source-location.js";
import type {
  SqlColumnDefinition,
  SqlTableDefinition,
} from "./sql-column-definitions.js";
import {
  findAlterTableAction,
  isNameAt,
  isSymbolAt,
  readParenthesizedList,
  wordAt,
  type Tokens,
} from "./sql-token-reading.js";
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
  // The ALTER TABLE that adds the foreign key, else the table.
  readonly foreignKey: (
    tableName: string,
    columnNames: readonly string[],
  ) => SourceLocation | null;
  // The ALTER TABLE that adds the named check, else the table.
  readonly check: (
    tableName: string,
    checkName: string | null,
  ) => SourceLocation | null;
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

// `ALTER TABLE t ADD [CONSTRAINT n] {FOREIGN KEY (…) | CHECK …}`.
type AddedConstraint = {
  readonly tableName: string;
  readonly name: string | null;
  readonly kind: "foreignKey" | "check";
  // The foreign key columns; empty for a check.
  readonly columnNames: readonly string[];
  readonly start: number;
};

function readForeignKeyColumns(
  tokens: Tokens,
  index: number,
): readonly string[] {
  const list = readParenthesizedList(tokens, index);
  return list.items.map((range) => tokens[range.start]?.value ?? "");
}

function readAddedConstraint(statement: SqlStatement): AddedConstraint | null {
  const { tokens } = statement;
  const action = findAlterTableAction(tokens);
  const isAdd =
    wordAt(tokens, 0) === "ALTER" &&
    wordAt(tokens, 1) === "TABLE" &&
    wordAt(tokens, action.index) === "ADD";
  const constraintIndex = action.index + 1;
  const hasName =
    wordAt(tokens, constraintIndex) === "CONSTRAINT" &&
    isNameAt(tokens, constraintIndex + 1);
  const index = constraintIndex + (hasName ? 2 : 0);
  const added = {
    tableName: action.tableName,
    name: hasName ? (tokens[constraintIndex + 1]?.value ?? null) : null,
    start: statement.start,
  };
  if (!isAdd || added.tableName === "") {
    return null;
  }
  if (wordAt(tokens, index) === "CHECK") {
    return { ...added, kind: "check", columnNames: [] };
  }
  const isForeignKey =
    wordAt(tokens, index) === "FOREIGN" &&
    wordAt(tokens, index + 1) === "KEY" &&
    isSymbolAt(tokens, index + 2, "(");
  return isForeignKey
    ? {
        ...added,
        kind: "foreignKey",
        columnNames: readForeignKeyColumns(tokens, index + 2),
      }
    : null;
}

function isSameNames(a: readonly string[], b: readonly string[]): boolean {
  return (
    a.length === b.length &&
    a.every((name, index) => toNameKey(name) === toNameKey(b[index] ?? ""))
  );
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

// What `read` gives for the statements, grouped by the name key of the table.
function groupByTable<Element extends { readonly tableName: string }>(
  statements: readonly SqlStatement[],
  read: (statement: SqlStatement) => Element | null,
): ReadonlyMap<string, readonly Element[]> {
  const groups = new Map<string, Element[]>();
  statements.forEach((statement) => {
    const element = read(statement);
    if (element !== null) {
      const key = toNameKey(element.tableName);
      const group = groups.get(key) ?? [];
      group.push(element);
      groups.set(key, group);
    }
  });
  return groups;
}

// Added columns grouped by the name key of their table, each group resolved
// by column name.
function groupAddedColumns(
  statements: readonly SqlStatement[],
): ReadonlyMap<string, NamedList<AddedColumn>> {
  return new Map(
    [...groupByTable(statements, readAddedColumn)].map(([key, columns]) => [
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
  const constraints = groupByTable(input.statements, readAddedConstraint);
  const constraint = (
    tableName: string,
    isWanted: (added: AddedConstraint) => boolean,
  ): SourceLocation | null => {
    const added = constraints.get(toNameKey(tableName))?.find(isWanted);
    return added === undefined ? table(tableName) : at(added.start);
  };
  return {
    at,
    table,
    column,
    tableDefinition: tables.find,
    columnDefinition,
    foreignKey: (tableName, columnNames) =>
      constraint(
        tableName,
        (added) =>
          added.kind === "foreignKey" &&
          isSameNames(added.columnNames, columnNames),
      ),
    check: (tableName, checkName) =>
      constraint(
        tableName,
        (added) =>
          added.kind === "check" &&
          checkName !== null &&
          added.name !== null &&
          toNameKey(added.name) === toNameKey(checkName),
      ),
  };
}
