import { finalizeImportDiagnostics } from "../importers/shared/import-diagnostics.js";
import { countDocumentElements } from "../importers/shared/import-limits.js";
import type { ImportDiagnostic } from "../importers/shared/import-types.js";
import type { GenerateId } from "../model/ids.js";
import {
  sortEnums,
  sortIndexes,
  sortNotes,
  sortRelations,
  sortSubjectAreas,
  sortTables,
} from "../model/ordering.js";
import type { Position } from "../model/position.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { BatchOperation, Operation } from "./operation.js";
import { remapMergedDocument } from "./remap-merged-document.js";

export type ImportMode =
  | { readonly mode: "new" }
  | { readonly mode: "merge"; readonly origin: Position };

export type ImportOperationBuild = {
  readonly operation: BatchOperation;
  readonly diagnostics: readonly ImportDiagnostic[];
};

function buildTableSteps(
  document: SchemaDocument,
  table: Table,
): readonly Operation[] {
  const { columnIds, primaryKeyColumnIds, ...fields } = table;
  const columnSteps = columnIds.map((columnId, insertAt): Operation => {
    const column = document.columns[columnId];
    if (column === undefined) {
      throw new Error(`Column ${columnId} of table ${table.id} does not exist`);
    }
    return { type: "addColumn", column, insertAt };
  });
  const keySteps: readonly Operation[] =
    primaryKeyColumnIds.length === 0
      ? []
      : [
          {
            type: "setPrimaryKey",
            tableId: table.id,
            columnIds: primaryKeyColumnIds,
          },
        ];
  return [{ type: "addTable", table: fields }, ...columnSteps, ...keySteps];
}

// Enums and subject areas come first because columns and tables reference
// them; relations come after every table because they may join any two.
function buildSteps(document: SchemaDocument): readonly Operation[] {
  return [
    ...sortEnums(document).map((element): Operation => ({
      type: "addEnum",
      enum: element,
    })),
    ...sortSubjectAreas(document).map((subjectArea): Operation => ({
      type: "addSubjectArea",
      subjectArea,
    })),
    ...sortTables(document).flatMap((table) =>
      buildTableSteps(document, table),
    ),
    ...sortIndexes(document).map((index): Operation => ({
      type: "addIndex",
      index,
    })),
    ...sortRelations(document).map((relation): Operation => ({
      type: "addRelation",
      relation,
    })),
    ...sortNotes(document).map((note): Operation => ({
      type: "addNote",
      note,
    })),
  ];
}

/**
 * Builds the one flat batch that imports `imported`. In "new" mode the target
 * must be empty (anything else is a programmer error) and ids, names and
 * positions are kept. In "merge" mode every element gets a fresh id, clashing
 * names get a `_2`, `_3`… suffix with one diagnostic each, and tables and
 * notes move so their top left corner is at `origin`. The schema name never
 * changes. The batch always applies to `target`.
 */
export function buildImportOperation(
  target: SchemaDocument,
  imported: SchemaDocument,
  mode: ImportMode,
  generateId: GenerateId,
): ImportOperationBuild {
  if (mode.mode === "new") {
    if (countDocumentElements(target) > 0) {
      throw new Error("A new-mode import needs an empty target schema");
    }
    return {
      operation: { type: "batch", operations: buildSteps(imported) },
      diagnostics: [],
    };
  }
  const merged = remapMergedDocument(target, imported, mode.origin, generateId);
  return {
    operation: { type: "batch", operations: buildSteps(merged.document) },
    diagnostics: finalizeImportDiagnostics(merged.diagnostics),
  };
}
