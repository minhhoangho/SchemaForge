import type { DocumentPath } from "../../document-path.js";
import type { ColumnId, IndexId } from "../../model/ids.js";
import { MAX_NAME_BYTES } from "../../model/name-limits.js";
import { sortIndexes, sortTables } from "../../model/ordering.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { createDiagnostic, finalizeDiagnostics } from "./diagnostics.js";
import type { GeneratorDiagnostic } from "./generator-types.js";
import { createNameAllocator } from "./name-allocator.js";

export type MysqlNames = {
  readonly columnNames: ReadonlyMap<ColumnId, string>;
  readonly indexNames: ReadonlyMap<IndexId, string>;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

type NamedElement<Id extends string> = {
  readonly id: Id;
  readonly name: string;
};

type AllocatedName<Id extends string> = {
  readonly id: Id;
  readonly name: string;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

// MySQL compares column and index names with utf8mb3_general_ci, so names
// that differ only by an accent collide within one table (spec section 5).
function allocateInTable<Id extends string>(
  elements: readonly NamedElement<Id>[],
  pathRoot: "columns" | "indexes",
): readonly AllocatedName<Id>[] {
  const allocator = createNameAllocator({
    reserved: [],
    comparison: "caseAndAccentInsensitive",
    separator: "_",
    maxBytes: MAX_NAME_BYTES,
  });
  return elements.map((element) => {
    const name = allocator.allocate(element.name);
    const path: DocumentPath = [pathRoot, element.id, "name"];
    return {
      id: element.id,
      name,
      diagnostics:
        name === element.name
          ? []
          : [createDiagnostic("identifier-collision-renamed", path)],
    };
  });
}

/** Column and index names for MySQL, renamed where MySQL would see a collision. */
export function allocateMysqlNames(schema: SchemaDocument): MysqlNames {
  const indexes = sortIndexes(schema);
  const perTable = sortTables(schema).map((table) => ({
    columns: allocateInTable(
      table.columnIds.flatMap((columnId) => schema.columns[columnId] ?? []),
      "columns",
    ),
    indexes: allocateInTable(
      indexes.filter((index) => index.tableId === table.id),
      "indexes",
    ),
  }));
  const columns = perTable.flatMap((table) => table.columns);
  const tableIndexes = perTable.flatMap((table) => table.indexes);
  return {
    columnNames: new Map(columns.map(({ id, name }) => [id, name])),
    indexNames: new Map(tableIndexes.map(({ id, name }) => [id, name])),
    diagnostics: finalizeDiagnostics(
      [...columns, ...tableIndexes].flatMap((element) => element.diagnostics),
    ),
  };
}
