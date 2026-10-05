import type {
  Column,
  DocumentPath,
  Enum,
  SchemaDocument,
  Table,
  TableId,
} from "@schemaforge/core";

export type IssueElementKind =
  "schema" | "table" | "column" | "relation" | "index" | "enum" | "subjectArea";

/** Interpolation variables of the `issues` namespace (spec section 4). */
export type IssueValues = {
  readonly table?: string;
  readonly column?: string;
  readonly index?: string;
  readonly enum?: string;
  readonly value?: string;
};

export type IssueTarget = {
  readonly kind: IssueElementKind;
  readonly elementId: string | null;
  readonly tableId: TableId | null;
  readonly values: IssueValues;
};

const ELEMENT_PREFIXES = [
  "tables",
  "columns",
  "relations",
  "indexes",
  "enums",
  "subjectAreas",
] as const;

type ElementPrefix = (typeof ELEMENT_PREFIXES)[number];

const SCHEMA_TARGET: IssueTarget = {
  kind: "schema",
  elementId: null,
  tableId: null,
  values: {},
};

const ENUM_VALUES_SEGMENT = "values";

function isElementPrefix(segment: string): segment is ElementPrefix {
  return ELEMENT_PREFIXES.some((prefix) => prefix === segment);
}

function readElementId(path: DocumentPath): string | null {
  const segment = path[1];
  return typeof segment === "string" ? segment : null;
}

function lookup<Value>(
  elements: Readonly<Record<string, Value>>,
  elementId: string | null,
): Value | undefined {
  return elementId === null ? undefined : elements[elementId];
}

function tableValues(table: Table | undefined): IssueValues {
  return table === undefined ? {} : { table: table.name };
}

function columnValues(column: Column | undefined): IssueValues {
  return column === undefined ? {} : { column: column.name };
}

function emptyTarget(
  kind: IssueElementKind,
  elementId: string | null,
): IssueTarget {
  return { kind, elementId, tableId: null, values: {} };
}

function resolveTable(
  document: SchemaDocument,
  elementId: string | null,
): IssueTarget {
  const table = lookup(document.tables, elementId);
  if (table === undefined) {
    return emptyTarget("table", elementId);
  }
  return {
    kind: "table",
    elementId,
    tableId: table.id,
    values: tableValues(table),
  };
}

function resolveColumn(
  document: SchemaDocument,
  elementId: string | null,
): IssueTarget {
  const column = lookup(document.columns, elementId);
  if (column === undefined) {
    return emptyTarget("column", elementId);
  }
  return {
    kind: "column",
    elementId,
    tableId: column.tableId,
    values: {
      ...columnValues(column),
      ...tableValues(lookup(document.tables, column.tableId)),
    },
  };
}

function resolveRelation(
  document: SchemaDocument,
  elementId: string | null,
): IssueTarget {
  const relation = lookup(document.relations, elementId);
  if (relation === undefined) {
    return emptyTarget("relation", elementId);
  }
  // The foreign key lives on the `from` side, so that is the table a reader looks at.
  const firstPair = relation.columnPairs[0];
  const foreignKeyColumn =
    firstPair === undefined
      ? undefined
      : lookup(document.columns, firstPair.fromColumnId);
  return {
    kind: "relation",
    elementId,
    tableId: relation.fromTableId,
    values: {
      ...columnValues(foreignKeyColumn),
      ...tableValues(lookup(document.tables, relation.fromTableId)),
    },
  };
}

function resolveIndex(
  document: SchemaDocument,
  elementId: string | null,
): IssueTarget {
  const index = lookup(document.indexes, elementId);
  if (index === undefined) {
    return emptyTarget("index", elementId);
  }
  return {
    kind: "index",
    elementId,
    tableId: index.tableId,
    values: {
      index: index.name,
      ...tableValues(lookup(document.tables, index.tableId)),
    },
  };
}

function enumValueAt(
  enumDefinition: Enum,
  path: DocumentPath,
): IssueValues | undefined {
  const valueIndex = path[3];
  if (path[2] !== ENUM_VALUES_SEGMENT || typeof valueIndex !== "number") {
    return undefined;
  }
  const value = enumDefinition.values[valueIndex];
  return value === undefined ? undefined : { value };
}

function resolveEnum(
  document: SchemaDocument,
  elementId: string | null,
  path: DocumentPath,
): IssueTarget {
  const enumDefinition = lookup(document.enums, elementId);
  if (enumDefinition === undefined) {
    return emptyTarget("enum", elementId);
  }
  return {
    kind: "enum",
    elementId,
    tableId: null,
    values: {
      enum: enumDefinition.name,
      ...enumValueAt(enumDefinition, path),
    },
  };
}

/**
 * Maps an issue path to the element it belongs to and to the variables that
 * translate its message. Unknown prefixes and missing elements resolve to a
 * target without values instead of throwing, because a path can outlive the
 * element it points at.
 */
export function resolveIssueTarget(
  document: SchemaDocument,
  path: DocumentPath,
): IssueTarget {
  const prefix = path[0];
  if (typeof prefix !== "string" || !isElementPrefix(prefix)) {
    return SCHEMA_TARGET;
  }

  const elementId = readElementId(path);
  switch (prefix) {
    case "tables":
      return resolveTable(document, elementId);
    case "columns":
      return resolveColumn(document, elementId);
    case "relations":
      return resolveRelation(document, elementId);
    case "indexes":
      return resolveIndex(document, elementId);
    case "enums":
      return resolveEnum(document, elementId, path);
    case "subjectAreas":
      return emptyTarget("subjectArea", elementId);
    default: {
      const unhandledPrefix: never = prefix;
      return unhandledPrefix;
    }
  }
}
