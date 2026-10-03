import type {
  Column,
  ColumnId,
  ElementChanges,
  Enum,
  EnumId,
  Relation,
  RelationId,
  SchemaDiff,
  SchemaDocument,
  Table,
  TableId,
} from "@schemaforge/core";

import type { DiffMark, ProposalPreview } from "../state/create-editor-store";
import { formatColumnType } from "./format-column-type";

export type ProposalDisplay = {
  readonly display: SchemaDocument;
  readonly marks: ReadonlyMap<string, DiffMark>;
};

export type ProposalChangeCounts = {
  readonly addedTables: number;
  readonly addedColumns: number;
  readonly changedTables: number;
  readonly changedColumns: number;
  readonly removedTables: number;
  readonly removedColumns: number;
  readonly cascadeRelations: number;
  readonly retypedColumns: number;
};

type DisplayParts = {
  readonly tables: Record<TableId, Table>;
  readonly columns: Record<ColumnId, Column>;
  readonly relations: Record<RelationId, Relation>;
  readonly enums: Record<EnumId, Enum>;
};

function addRemovedTables(
  parts: DisplayParts,
  base: SchemaDocument,
  diff: SchemaDiff,
): void {
  for (const tableId of diff.tables.removed) {
    const table = base.tables[tableId];
    if (table === undefined) {
      continue;
    }
    parts.tables[tableId] = table;
    for (const columnId of table.columnIds) {
      const column = base.columns[columnId];
      if (column !== undefined) {
        parts.columns[columnId] = column;
      }
    }
  }
}

// Inserting in ascending old index puts every removed column back where it
// was, even when several columns of one table were removed.
function addRemovedColumns(
  parts: DisplayParts,
  base: SchemaDocument,
  diff: SchemaDiff,
): void {
  const reinserted = diff.columns.removed
    .flatMap((columnId) => {
      const column = base.columns[columnId];
      const baseTable =
        column === undefined ? undefined : base.tables[column.tableId];
      return column === undefined ||
        baseTable === undefined ||
        Object.hasOwn(parts.columns, columnId)
        ? []
        : [{ column, index: baseTable.columnIds.indexOf(columnId) }];
    })
    .toSorted((first, second) => first.index - second.index);
  for (const { column, index } of reinserted) {
    const table = parts.tables[column.tableId];
    if (table === undefined) {
      continue;
    }
    const columnIds = table.columnIds.toSpliced(
      Math.min(index, table.columnIds.length),
      0,
      column.id,
    );
    parts.tables[column.tableId] = { ...table, columnIds };
    parts.columns[column.id] = column;
  }
}

function addRemovedRelationsAndEnums(
  parts: DisplayParts,
  base: SchemaDocument,
  diff: SchemaDiff,
): void {
  for (const relationId of diff.relations.removed) {
    const relation = base.relations[relationId];
    if (
      relation !== undefined &&
      Object.hasOwn(parts.tables, relation.fromTableId) &&
      Object.hasOwn(parts.tables, relation.toTableId)
    ) {
      parts.relations[relationId] = relation;
    }
  }
  for (const enumId of diff.enums.removed) {
    const removedEnum = base.enums[enumId];
    if (removedEnum !== undefined) {
      parts.enums[enumId] = removedEnum;
    }
  }
}

function addMarks(
  marks: Map<string, DiffMark>,
  changes: ElementChanges<string>,
): void {
  for (const id of changes.added) {
    marks.set(id, "added");
  }
  for (const id of changes.changed) {
    marks.set(id, "changed");
  }
  for (const id of changes.removed) {
    marks.set(id, "removed");
  }
}

/**
 * Builds the document the canvas draws during a preview: `preview` plus the
 * tables, columns, relations and enums it removed from `base`, and the diff
 * mark of every table, column and relation. Removed indexes are not drawn.
 * The display document is for drawing only and never reaches `dispatch`.
 */
export function buildProposalDisplay(
  base: SchemaDocument,
  preview: SchemaDocument,
  diff: SchemaDiff,
): ProposalDisplay {
  const parts: DisplayParts = {
    tables: { ...preview.tables },
    columns: { ...preview.columns },
    relations: { ...preview.relations },
    enums: { ...preview.enums },
  };
  addRemovedTables(parts, base, diff);
  addRemovedColumns(parts, base, diff);
  addRemovedRelationsAndEnums(parts, base, diff);

  const marks = new Map<string, DiffMark>();
  addMarks(marks, diff.tables);
  addMarks(marks, diff.columns);
  addMarks(marks, diff.relations);
  return { display: { ...preview, ...parts }, marks };
}

function isNewCascade(relation: Relation, previous: Relation | null): boolean {
  return (
    (relation.onDelete === "cascade" && previous?.onDelete !== "cascade") ||
    (relation.onUpdate === "cascade" && previous?.onUpdate !== "cascade")
  );
}

function countCascadeRelations(
  base: SchemaDocument,
  preview: SchemaDocument,
  diff: SchemaDiff,
): number {
  const added = diff.relations.added.filter((relationId) => {
    const relation = preview.relations[relationId];
    return relation !== undefined && isNewCascade(relation, null);
  });
  const changed = diff.relations.changed.filter((relationId) => {
    const relation = preview.relations[relationId];
    const previous = base.relations[relationId];
    return (
      relation !== undefined &&
      previous !== undefined &&
      isNewCascade(relation, previous)
    );
  });
  return added.length + changed.length;
}

// Both sides format against the display enums, so renaming an enum does not
// count as retyping its columns.
function countRetypedColumns(
  proposal: Pick<ProposalPreview, "base" | "preview" | "display" | "diff">,
): number {
  const { base, preview, display, diff } = proposal;
  return diff.columns.changed.filter((columnId) => {
    const before = base.columns[columnId];
    const after = preview.columns[columnId];
    return (
      before !== undefined &&
      after !== undefined &&
      formatColumnType(before.type, display.enums) !==
        formatColumnType(after.type, display.enums)
    );
  }).length;
}

/**
 * Counts the changes of a proposal for its card and the preview bar. Column
 * counts include the columns of added and removed tables.
 */
export function countProposalChanges(
  proposal: Pick<ProposalPreview, "base" | "preview" | "display" | "diff">,
): ProposalChangeCounts {
  const { base, preview, diff } = proposal;
  return {
    addedTables: diff.tables.added.length,
    addedColumns: diff.columns.added.length,
    changedTables: diff.tables.changed.length,
    changedColumns: diff.columns.changed.length,
    removedTables: diff.tables.removed.length,
    removedColumns: diff.columns.removed.length,
    cascadeRelations: countCascadeRelations(base, preview, diff),
    retypedColumns: countRetypedColumns(proposal),
  };
}
