import type { EnumId, SchemaDocument } from "@schemaforge/core";
import { sortTables } from "@schemaforge/core";

export type EnumUsage = ReadonlyMap<EnumId, readonly string[]>;

/*
 * The same documented exception as `issue-index.ts` (plan issue 25): the enum
 * list reads the usage of every enum on each render, and the only key shared
 * by those renders is the document reference. A WeakMap keeps no document
 * alive, and each editor store owns its own document, so nothing leaks between
 * two schemas.
 */
const usageByDocument = new WeakMap<SchemaDocument, EnumUsage>();

function lookup<Value>(
  elements: Readonly<Record<string, Value>>,
  elementId: string,
): Value | undefined {
  return elements[elementId];
}

function createEnumUsage(document: SchemaDocument): EnumUsage {
  const usage = new Map<EnumId, string[]>(
    Object.values(document.enums).map((enumDefinition) => [
      enumDefinition.id,
      [],
    ]),
  );
  for (const table of sortTables(document)) {
    for (const columnId of table.columnIds) {
      const column = lookup(document.columns, columnId);
      if (column?.type.kind !== "enum") {
        continue;
      }
      usage.get(column.type.enumId)?.push(`${table.name}.${column.name}`);
    }
  }
  return usage;
}

/**
 * Lists, for every enum, the `table.column` labels of the columns typed with
 * it, ordered by `sortTables` and then by the column order of each table.
 */
export function getEnumUsage(document: SchemaDocument): EnumUsage {
  const cached = usageByDocument.get(document);
  if (cached !== undefined) {
    return cached;
  }
  const usage = createEnumUsage(document);
  usageByDocument.set(document, usage);
  return usage;
}
