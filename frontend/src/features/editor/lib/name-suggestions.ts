import type { SchemaDocument, TableId } from "@schemaforge/core";

export const TABLE_NAME_PREFIX = "table_";
export const COLUMN_NAME_PREFIX = "column_";
export const ENUM_NAME_PREFIX = "enum_";
export const ENUM_VALUE_PREFIX = "value_";

const NAME_SEPARATOR = "_";
const FIRST_NUMBER = 1;
const FIRST_SUFFIX_NUMBER = 2;

// Must match toNameKey in packages/core, which is not part of core's public
// API (Vấn đề 27). toLowerCase, unlike toLocaleLowerCase, gives the same key
// in every locale.
function toNameKey(name: string): string {
  return name.toLowerCase();
}

function toNameKeySet(names: readonly string[]): ReadonlySet<string> {
  return new Set(names.map(toNameKey));
}

/** Returns `${prefix}${n}` for the smallest n from 1 whose name is still free. */
export function suggestNumberedName(
  prefix: string,
  usedNames: readonly string[],
): string {
  const usedNameKeys = toNameKeySet(usedNames);
  let number = FIRST_NUMBER;
  while (usedNameKeys.has(toNameKey(`${prefix}${String(number)}`))) {
    number += 1;
  }
  return `${prefix}${String(number)}`;
}

export function suggestTableName(document: SchemaDocument): string {
  const usedNames = Object.values(document.tables).map((table) => table.name);
  return suggestNumberedName(TABLE_NAME_PREFIX, usedNames);
}

export function suggestColumnName(
  document: SchemaDocument,
  tableId: TableId,
): string {
  const usedNames = Object.values(document.columns)
    .filter((column) => column.tableId === tableId)
    .map((column) => column.name);
  return suggestNumberedName(COLUMN_NAME_PREFIX, usedNames);
}

export function suggestEnumName(document: SchemaDocument): string {
  const usedNames = Object.values(document.enums).map(
    (enumeration) => enumeration.name,
  );
  return suggestNumberedName(ENUM_NAME_PREFIX, usedNames);
}

export function suggestEnumValue(values: readonly string[]): string {
  return suggestNumberedName(ENUM_VALUE_PREFIX, values);
}

/** Returns `<left>_<right>`, adding `_2`, `_3`… while a table already holds the name. */
export function suggestJunctionTableName(
  document: SchemaDocument,
  input: {
    readonly leftTableName: string;
    readonly rightTableName: string;
  },
): string {
  const baseName = `${input.leftTableName}${NAME_SEPARATOR}${input.rightTableName}`;
  const usedNameKeys = toNameKeySet(
    Object.values(document.tables).map((table) => table.name),
  );

  let name = baseName;
  let suffixNumber = FIRST_SUFFIX_NUMBER;
  while (usedNameKeys.has(toNameKey(name))) {
    name = `${baseName}${NAME_SEPARATOR}${String(suffixNumber)}`;
    suffixNumber += 1;
  }
  return name;
}
