import type { Column } from "../model/column.js";
import type { Enum } from "../model/enum.js";
import type { GenerateId } from "../model/ids.js";
import type { Note } from "../model/note.js";
import type { Relation } from "../model/relation.js";
import { CURRENT_SCHEMA_VERSION } from "../model/schema-document.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { SubjectArea } from "../model/subject-area.js";
import type { Index } from "../model/table-index.js";
import type { Table } from "../model/table.js";
import { parseSchemaDocument } from "../parse/parse-schema-document.js";

/** Returns a deterministic generator producing "1", "2", "3"... from its own counter. */
export function createCounterIdGenerator(): GenerateId {
  let counter = 0;
  return (): string => {
    counter += 1;
    return String(counter);
  };
}

// Ids always look like "<prefix>_<token>", so the default name is the token
// after the first underscore.
function deriveNameFromId(id: string): string {
  const separatorIndex = id.indexOf("_");
  return separatorIndex === -1 ? id : id.slice(separatorIndex + 1);
}

export function makeTable(
  overrides: Partial<Omit<Table, "columnIds">> & Pick<Table, "id">,
): Table {
  return {
    name: deriveNameFromId(overrides.id),
    comment: "",
    position: { x: 0, y: 0 },
    subjectAreaId: null,
    primaryKeyColumnIds: [],
    ...overrides,
    columnIds: [],
  };
}

export function makeColumn(
  overrides: Partial<Column> & Pick<Column, "id" | "tableId">,
): Column {
  return {
    name: deriveNameFromId(overrides.id),
    type: { kind: "integer" },
    isNullable: false,
    defaultValue: null,
    isUnique: false,
    isAutoIncrement: false,
    comment: "",
    ...overrides,
  };
}

export function makeRelation(
  overrides: Partial<Relation> &
    Pick<Relation, "id" | "fromTableId" | "toTableId" | "columnPairs">,
): Relation {
  return {
    kind: "oneToMany",
    onDelete: "noAction",
    onUpdate: "noAction",
    ...overrides,
  };
}

export function makeIndex(
  overrides: Partial<Index> & Pick<Index, "id" | "tableId" | "columnIds">,
): Index {
  return {
    name: deriveNameFromId(overrides.id),
    isUnique: false,
    ...overrides,
  };
}

export function makeEnum(overrides: Partial<Enum> & Pick<Enum, "id">): Enum {
  return {
    name: deriveNameFromId(overrides.id),
    values: ["active"],
    ...overrides,
  };
}

export function makeSubjectArea(
  overrides: Partial<SubjectArea> & Pick<SubjectArea, "id">,
): SubjectArea {
  return {
    name: deriveNameFromId(overrides.id),
    ...overrides,
  };
}

export function makeNote(overrides: Partial<Note> & Pick<Note, "id">): Note {
  return {
    text: "note",
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

export type SchemaParts = {
  readonly name?: string;
  readonly tables?: readonly Table[];
  readonly columns?: readonly Column[];
  readonly relations?: readonly Relation[];
  readonly indexes?: readonly Index[];
  readonly enums?: readonly Enum[];
  readonly subjectAreas?: readonly SubjectArea[];
  readonly notes?: readonly Note[];
};

const DEFAULT_SCHEMA_NAME = "test";

// Every element of `elements` is expected to have already been validated by
// its own `make*` factory, so the only way this can fail is a repeated id.
function keyById<Element extends { readonly id: string }>(
  elements: readonly Element[],
): Readonly<Record<string, Element>> {
  const map: Record<string, Element> = {};
  for (const element of elements) {
    if (Object.hasOwn(map, element.id)) {
      throw new Error(
        `buildSchema: duplicate id "${element.id}" in the same array`,
      );
    }
    map[element.id] = element;
  }
  return map;
}

function withDerivedColumnIds(table: Table, columns: readonly Column[]): Table {
  return {
    ...table,
    columnIds: columns
      .filter((column) => column.tableId === table.id)
      .map((column) => column.id),
  };
}

/**
 * Assembles a `SchemaDocument` from loose parts and parses it, so the result
 * can never be structurally invalid. Throws when parsing fails.
 */
export function buildSchema(parts: SchemaParts): SchemaDocument {
  const columns = parts.columns ?? [];
  const tables = (parts.tables ?? []).map((table) =>
    withDerivedColumnIds(table, columns),
  );

  const parsed = parseSchemaDocument({
    version: CURRENT_SCHEMA_VERSION,
    name: parts.name ?? DEFAULT_SCHEMA_NAME,
    tables: keyById(tables),
    columns: keyById(columns),
    relations: keyById(parts.relations ?? []),
    indexes: keyById(parts.indexes ?? []),
    enums: keyById(parts.enums ?? []),
    subjectAreas: keyById(parts.subjectAreas ?? []),
    notes: keyById(parts.notes ?? []),
  });

  if (!parsed.isOk) {
    throw new Error(
      `buildSchema produced an invalid document: ${JSON.stringify(parsed.error)}`,
    );
  }
  return parsed.value;
}
