import type { Column } from "../../model/column.js";
import type { ColumnType } from "../../model/column-type.js";
import type { ColumnId, TableId } from "../../model/ids.js";
import type { Position } from "../../model/position.js";
import type { Relation } from "../../model/relation.js";
import { CURRENT_SCHEMA_VERSION } from "../../model/schema-document.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Index } from "../../model/table-index.js";
import type { Table } from "../../model/table.js";
import { createNameClaimer } from "../../operations/pick-unused-name.js";
import type { NameClaimer } from "../../operations/pick-unused-name.js";
import { claimIndexName } from "../../operations/suggest-index-name.js";
import { parseSchemaDocument } from "../../parse/parse-schema-document.js";
import { err, ok } from "../../result.js";
import { assignImportIds } from "./assign-import-ids.js";
import type { AssignedIds } from "./assign-import-ids.js";
import { toDocumentPath } from "./draft-target-path.js";
import type { ImportDraft } from "./import-draft.js";
import {
  createImportDiagnostic,
  finalizeImportDiagnostics,
} from "./import-diagnostics.js";
import {
  MAX_IMPORTED_ELEMENTS,
  tooManyElementsFailure,
} from "./import-limits.js";
import type {
  ImportDiagnostic,
  ImportOptions,
  ImportResult,
} from "./import-types.js";
import { placeElements } from "./place-elements.js";
import type { Placement } from "./place-elements.js";
import { elementAt, resolveDraftReferences } from "./resolve-references.js";
import type {
  ResolvedColumn,
  ResolvedDraft,
  ResolvedIndex,
  ResolvedTable,
} from "./resolve-references.js";

function countDraftElements(draft: ImportDraft): number {
  return [
    draft.tables,
    ...draft.tables.map((table) => table.columns),
    draft.relations,
    draft.indexes,
    draft.enums,
    draft.subjectAreas,
    draft.notes,
  ].reduce((total, elements) => total + elements.length, 0);
}

function placeDraft(
  draft: ImportDraft,
  resolved: ResolvedDraft,
  options: ImportOptions,
): Placement {
  const tables = resolved.tables.map(({ columns, subjectAreaIndex }) => ({
    columnCount: columns.length,
    subjectAreaName:
      subjectAreaIndex === null
        ? null
        : elementAt(draft.subjectAreas, subjectAreaIndex).name,
  }));
  return placeElements(
    { tables, noteCount: draft.notes.length },
    options.layout,
  );
}

function toColumn(
  { column, type }: ResolvedColumn,
  id: ColumnId,
  tableId: TableId,
  ids: AssignedIds,
): Column {
  const columnType: ColumnType =
    type.kind === "enum"
      ? { kind: "enum", enumId: elementAt(ids.enums, type.enumIndex) }
      : type;
  return {
    id,
    tableId,
    name: column.name,
    type: columnType,
    isNullable: column.isNullable,
    defaultValue: column.defaultValue,
    isUnique: column.isUnique,
    isAutoIncrement: column.isAutoIncrement,
    comment: column.comment,
  };
}

function buildTablesAndColumns(
  resolved: ResolvedDraft,
  ids: AssignedIds,
  positions: readonly Position[],
): Pick<SchemaDocument, "tables" | "columns"> {
  const tables: [TableId, Table][] = [];
  const columns: [ColumnId, Column][] = [];
  resolved.tables.forEach((resolvedTable, tableIndex) => {
    const { table, subjectAreaIndex, primaryKey } = resolvedTable;
    const id = elementAt(ids.tables, tableIndex);
    const columnIds = elementAt(ids.columns, tableIndex);
    tables.push([
      id,
      {
        id,
        name: table.name,
        comment: table.comment,
        position: elementAt(positions, tableIndex),
        subjectAreaId:
          subjectAreaIndex === null
            ? null
            : elementAt(ids.subjectAreas, subjectAreaIndex),
        columnIds,
        primaryKeyColumnIds: primaryKey.map((at) => elementAt(columnIds, at)),
      },
    ]);
    resolvedTable.columns.forEach((column, position) => {
      const columnId = elementAt(columnIds, position);
      columns.push([columnId, toColumn(column, columnId, id, ids)]);
    });
  });
  return {
    tables: Object.fromEntries(tables),
    columns: Object.fromEntries(columns),
  };
}

function claimDraftIndexName(
  claimer: NameClaimer,
  { index, columns }: ResolvedIndex,
  table: ResolvedTable,
): string {
  if (index.name !== null) {
    claimer.reserve(index.name);
    return index.name;
  }
  return claimIndexName(claimer, {
    tableName: table.table.name,
    columnNames: columns.map((at) => elementAt(table.columns, at).column.name),
    isUnique: index.isUnique,
  });
}

// Named in draft order, so each suggestion sees the names before it, as
// suggestIndexName on the document built so far would.
function buildIndexes(
  base: SchemaDocument,
  resolved: ResolvedDraft,
  ids: AssignedIds,
): SchemaDocument["indexes"] {
  const claimer = createNameClaimer(
    Object.values(base.tables).map((table) => table.name),
  );
  return Object.fromEntries(
    resolved.indexes.map((resolvedIndex, position) => {
      const { tableIndex, columns } = resolvedIndex;
      const table = elementAt(resolved.tables, tableIndex);
      const columnIds = elementAt(ids.columns, tableIndex);
      const id = elementAt(ids.indexes, position);
      const element: Index = {
        id,
        tableId: elementAt(ids.tables, tableIndex),
        name: claimDraftIndexName(claimer, resolvedIndex, table),
        columnIds: columns.map((at) => elementAt(columnIds, at)),
        isUnique: resolvedIndex.index.isUnique,
      };
      return [id, element];
    }),
  );
}

function buildRelations(
  resolved: ResolvedDraft,
  ids: AssignedIds,
): SchemaDocument["relations"] {
  return Object.fromEntries(
    resolved.relations.map((resolvedRelation, position) => {
      const { relation, fromTableIndex, toTableIndex } = resolvedRelation;
      const fromColumnIds = elementAt(ids.columns, fromTableIndex);
      const toColumnIds = elementAt(ids.columns, toTableIndex);
      const id = elementAt(ids.relations, position);
      const element: Relation = {
        id,
        kind: relation.kind,
        fromTableId: elementAt(ids.tables, fromTableIndex),
        toTableId: elementAt(ids.tables, toTableIndex),
        columnPairs: resolvedRelation.columnPairs.map(({ from, to }) => ({
          fromColumnId: elementAt(fromColumnIds, from),
          toColumnId: elementAt(toColumnIds, to),
        })),
        onDelete: relation.onDelete,
        onUpdate: relation.onUpdate,
      };
      return [id, element];
    }),
  );
}

function buildDocument(
  draft: ImportDraft,
  resolved: ResolvedDraft,
  ids: AssignedIds,
  options: ImportOptions,
): SchemaDocument {
  const placement = placeDraft(draft, resolved, options);
  const base: SchemaDocument = {
    version: CURRENT_SCHEMA_VERSION,
    name: draft.name ?? options.fallbackSchemaName,
    ...buildTablesAndColumns(resolved, ids, placement.tables),
    relations: buildRelations(resolved, ids),
    indexes: {},
    enums: Object.fromEntries(
      draft.enums.map(({ name, values }, position) => {
        const id = elementAt(ids.enums, position);
        return [id, { id, name, values }];
      }),
    ),
    subjectAreas: Object.fromEntries(
      draft.subjectAreas.map(({ name }, position) => {
        const id = elementAt(ids.subjectAreas, position);
        return [id, { id, name }];
      }),
    ),
    notes: Object.fromEntries(
      draft.notes.map(({ text }, position) => {
        const id = elementAt(ids.notes, position);
        return [
          id,
          { id, text, position: elementAt(placement.notes, position) },
        ];
      }),
    ),
  };
  return { ...base, indexes: buildIndexes(base, resolved, ids) };
}

function toImportDiagnostics(
  draft: ImportDraft,
  ids: AssignedIds,
): readonly ImportDiagnostic[] {
  return draft.diagnostics.map(({ code, location, target }) =>
    createImportDiagnostic(code, location, toDocumentPath(target, draft, ids)),
  );
}

/**
 * Turns a name-based draft into a valid document (spec section 1): checks the
 * element limit, resolves references, assigns ids in the documented order,
 * places tables and notes, and maps draft diagnostics to document paths.
 */
export function assembleDocument(
  draft: ImportDraft,
  options: ImportOptions,
): ImportResult {
  if (countDraftElements(draft) > MAX_IMPORTED_ELEMENTS) {
    return err(tooManyElementsFailure());
  }
  const resolved = resolveDraftReferences(draft);
  const ids = assignImportIds(draft, resolved, options.generateId);
  const parsed = parseSchemaDocument(
    buildDocument(draft, resolved, ids, options),
  );
  if (!parsed.isOk) {
    throw new Error(
      `Importer built an invalid document: ${JSON.stringify(parsed.error)}`,
    );
  }
  return ok({
    document: parsed.value,
    diagnostics: finalizeImportDiagnostics([
      ...resolved.diagnostics,
      ...toImportDiagnostics(draft, ids),
    ]),
  });
}
