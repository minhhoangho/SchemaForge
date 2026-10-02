import type { ColumnId, TableId } from "../../model/ids.js";
import type { Relation } from "../../model/relation.js";
import type { Table } from "../../model/table.js";
import { orderColumnPairsByReferencedKey } from "../shared/relation-graph.js";
import type { DrizzleContext } from "./drizzle-context.js";
import { columnReference } from "./drizzle-context.js";
import { hasInverseField } from "./drizzle-names.js";

type RelationField = {
  readonly line: string;
  readonly helper: "one" | "many";
};

const FIELD_INDENT = "  ";

function tableVariable(context: DrizzleContext, tableId: TableId): string {
  return context.names.tableVariables.get(tableId) ?? "";
}

function forwardField(
  context: DrizzleContext,
  relation: Relation,
): RelationField {
  const pairs = orderColumnPairsByReferencedKey(context.schema, relation);
  const source = tableVariable(context, relation.fromTableId);
  const target = tableVariable(context, relation.toTableId);
  const listOf = (owner: string, columnIds: readonly ColumnId[]): string =>
    columnIds
      .map((columnId) => columnReference(context, owner, columnId))
      .join(", ");
  const relationName = context.fields.relationNames.get(relation.id);
  const config = [
    `fields: [${listOf(
      source,
      pairs.map((pair) => pair.fromColumnId),
    )}]`,
    `references: [${listOf(
      target,
      pairs.map((pair) => pair.toColumnId),
    )}]`,
    ...(relationName === undefined
      ? []
      : [`relationName: ${JSON.stringify(relationName)}`]),
  ].join(", ");
  const key = context.fields.forwardFieldNames.get(relation.id) ?? "";
  return {
    line: `${FIELD_INDENT}${key}: one(${target}, { ${config} }),`,
    helper: "one",
  };
}

// The inverse side of a named one-to-one relation is never asked for here:
// `hasInverseField` leaves it out (Vấn đề 18).
function inverseField(
  context: DrizzleContext,
  relation: Relation,
): RelationField {
  const source = tableVariable(context, relation.fromTableId);
  const key = context.fields.inverseFieldNames.get(relation.id) ?? "";
  if (relation.kind === "oneToOne") {
    return { line: `${FIELD_INDENT}${key}: one(${source}),`, helper: "one" };
  }
  const relationName = context.fields.relationNames.get(relation.id);
  const config =
    relationName === undefined
      ? ""
      : `, { relationName: ${JSON.stringify(relationName)} }`;
  return {
    line: `${FIELD_INDENT}${key}: many(${source}${config}),`,
    helper: "many",
  };
}

/** The `relations()` block of a table, or no lines when it has no field. */
export function renderDrizzleRelations(
  context: DrizzleContext,
  table: Table,
): readonly string[] {
  const variable = context.names.relationsVariables.get(table.id);
  if (variable === undefined) {
    return [];
  }
  const fields = [
    ...context.relations
      .filter((relation) => relation.fromTableId === table.id)
      .map((relation) => forwardField(context, relation)),
    ...context.relations
      .filter(
        (relation) =>
          relation.toTableId === table.id &&
          hasInverseField(context.fields, relation),
      )
      .map((relation) => inverseField(context, relation)),
  ];
  const helpers = (["one", "many"] as const).filter((helper) =>
    fields.some((field) => field.helper === helper),
  );
  return [
    `export const ${variable} = relations(${tableVariable(context, table.id)}, ({ ${helpers.join(", ")} }) => ({`,
    ...fields.map((field) => field.line),
    "}));",
  ];
}
