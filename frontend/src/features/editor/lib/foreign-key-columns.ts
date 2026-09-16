import type { SchemaDocument } from "@schemaforge/core";

/*
 * The same documented exception to "no module-level mutable state" as the
 * issue index (plan issue 25). Every column row asks whether its column is a
 * foreign key, and the only key they share is the `relations` map itself. Core
 * keeps that map's reference while no relation changes, so the set is built
 * once per relations map. A WeakMap holds no key alive longer than the
 * document that owns it, and each editor store owns its own document, so
 * nothing leaks between two schemas.
 */
const columnIdsByRelations = new WeakMap<
  SchemaDocument["relations"],
  ReadonlySet<string>
>();

/** Returns the id of every column that is the `from` side of a relation. */
export function getForeignKeyColumnIds(
  relations: SchemaDocument["relations"],
): ReadonlySet<string> {
  const cached = columnIdsByRelations.get(relations);
  if (cached !== undefined) {
    return cached;
  }
  const columnIds = new Set(
    Object.values(relations).flatMap((relation) =>
      relation.columnPairs.map((pair) => pair.fromColumnId),
    ),
  );
  columnIdsByRelations.set(relations, columnIds);
  return columnIds;
}
