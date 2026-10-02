import type { ColumnId, TableId } from "../../model/ids.js";
import type { ReferentialAction, Relation } from "../../model/relation.js";
import type { Table } from "../../model/table.js";
import { resolveReferentialAction } from "../shared/dialect-constraints.js";
import { createDiagnostic } from "../shared/diagnostics.js";
import { orderColumnPairsByReferencedKey } from "../shared/relation-graph.js";
import type { Diagnosed } from "../shared/sql-ddl-model-context.js";
import type { PrismaContext } from "./prisma-context.js";
import { formatPrismaString } from "./prisma-field-type.js";

const FIELD_INDENT = "  ";

const PRISMA_ACTIONS: Readonly<Record<ReferentialAction, string>> = {
  noAction: "NoAction",
  restrict: "Restrict",
  cascade: "Cascade",
  setNull: "SetNull",
  setDefault: "SetDefault",
};

type Actions = { readonly onDelete: string; readonly onUpdate: string };

function resolveActions(
  context: PrismaContext,
  relation: Relation,
): Diagnosed<Actions> {
  if (context.sql.cascadeConflicts.has(relation.id)) {
    return {
      value: { onDelete: "NoAction", onUpdate: "NoAction" },
      diagnostics: [
        createDiagnostic("referential-action-cycle", [
          "relations",
          relation.id,
        ]),
      ],
    };
  }
  const onDelete = resolveReferentialAction(
    context.provider,
    relation.onDelete,
  );
  const onUpdate = resolveReferentialAction(
    context.provider,
    relation.onUpdate,
  );
  const lossyEvents = [
    ...(onDelete.isLossy ? ["onDelete"] : []),
    ...(onUpdate.isLossy ? ["onUpdate"] : []),
  ];
  return {
    value: {
      onDelete: PRISMA_ACTIONS[onDelete.action],
      onUpdate: PRISMA_ACTIONS[onUpdate.action],
    },
    diagnostics: lossyEvents.map((event) =>
      createDiagnostic("referential-action-not-supported", [
        "relations",
        relation.id,
        event,
      ]),
    ),
  };
}

export function fieldList(
  context: PrismaContext,
  columnIds: readonly ColumnId[],
): string {
  const names = columnIds.map(
    (columnId) => context.fields.columnFieldNames.get(columnId) ?? "",
  );
  return `[${names.join(", ")}]`;
}

// Prisma requires @ignore on a field pointing to an ignored model, but warns
// about it inside a model that is ignored itself.
function ignoreSuffix(
  context: PrismaContext,
  ownTableId: TableId,
  otherTableId: TableId,
): string {
  const { ignoredTableIds } = context;
  return ignoredTableIds.has(otherTableId) && !ignoredTableIds.has(ownTableId)
    ? " @ignore"
    : "";
}

function forwardField(
  context: PrismaContext,
  relation: Relation,
): Diagnosed<string> {
  const { schema, fields } = context;
  const pairs = orderColumnPairsByReferencedKey(schema, relation);
  const isOptional = pairs.some(
    (pair) => schema.columns[pair.fromColumnId]?.isNullable === true,
  );
  const relationName = fields.relationNames.get(relation.id);
  const actions = resolveActions(context, relation);
  const relationArguments = [
    ...(relationName === undefined ? [] : [formatPrismaString(relationName)]),
    `fields: ${fieldList(
      context,
      pairs.map((pair) => pair.fromColumnId),
    )}`,
    `references: ${fieldList(
      context,
      pairs.map((pair) => pair.toColumnId),
    )}`,
    `onDelete: ${actions.value.onDelete}`,
    `onUpdate: ${actions.value.onUpdate}`,
  ];
  const fieldName = fields.forwardFieldNames.get(relation.id) ?? "";
  const modelName = context.modelNames.get(relation.toTableId) ?? "";
  const optionalMark = isOptional ? "?" : "";
  return {
    value: `${FIELD_INDENT}${fieldName} ${modelName}${optionalMark} @relation(${relationArguments.join(", ")})${ignoreSuffix(context, relation.fromTableId, relation.toTableId)}`,
    diagnostics: actions.diagnostics,
  };
}

function inverseField(context: PrismaContext, relation: Relation): string {
  const fieldName = context.fields.inverseFieldNames.get(relation.id) ?? "";
  const modelName = context.modelNames.get(relation.fromTableId) ?? "";
  const cardinality = relation.kind === "oneToMany" ? "[]" : "?";
  const relationName = context.fields.relationNames.get(relation.id);
  const relationAttribute =
    relationName === undefined
      ? ""
      : ` @relation(${formatPrismaString(relationName)})`;
  return `${FIELD_INDENT}${fieldName} ${modelName}${cardinality}${relationAttribute}${ignoreSuffix(context, relation.toTableId, relation.fromTableId)}`;
}

/** Forward relation fields, then inverse ones, each in `sortRelations` order. */
export function renderRelationFields(
  context: PrismaContext,
  table: Table,
): Diagnosed<readonly string[]> {
  const forward = context.relations
    .filter((relation) => relation.fromTableId === table.id)
    .map((relation) => forwardField(context, relation));
  const inverse = context.relations
    .filter((relation) => relation.toTableId === table.id)
    .map((relation) => inverseField(context, relation));
  return {
    value: [...forward.map((field) => field.value), ...inverse],
    diagnostics: forward.flatMap((field) => field.diagnostics),
  };
}
