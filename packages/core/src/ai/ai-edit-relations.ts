import type { OperationError } from "../error-codes.js";
import type { ColumnId } from "../model/ids.js";
import { createRelationId } from "../model/ids.js";
import type { ColumnPair, Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import { buildManyToMany } from "../operations/build-many-to-many.js";
import { buildRelation } from "../operations/build-relation.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import type { AiEditError } from "./ai-edit-error-codes.js";
import type {
  AiEditContext,
  Resolved,
  Translation,
} from "./ai-edit-resolve.js";
import {
  failWith,
  resolveColumns,
  resolveTable,
  tableAt,
} from "./ai-edit-resolve.js";
import type { AiEdit, AiEditInput } from "./ai-edit-tools.js";
import { formatAiName } from "./describe-path-for-ai.js";
import { aiTablePosition } from "./place-ai-table.js";
import { findRelationsBetween } from "./resolve-ai-names.js";

type RelationEdit = Extract<
  AiEdit,
  { tool: "addRelation" | "updateRelation" | "removeRelation" }
>;

type RelationEnds = { readonly from: Table; readonly to: Table };

type AddRelationInput = AiEditInput<"addRelation">;

const JUNCTION_NAME_SEPARATOR = "_";
const DEFAULT_REFERENTIAL_ACTION = "noAction";

// A relation has no name, so it is named by its tables and, when given, the
// source columns the model passed: relations.orders(user_id)->users.
function relationAt(
  ends: RelationEnds,
  fromColumns: readonly string[] | undefined,
): string {
  const columns =
    fromColumns === undefined
      ? ""
      : `(${fromColumns.map(formatAiName).join(",")})`;
  return `relations.${formatAiName(ends.from.name)}${columns}->${formatAiName(ends.to.name)}`;
}

function resolveEnds(
  schema: SchemaDocument,
  input: { readonly fromTable: string; readonly toTable: string },
): Resolved<RelationEnds> {
  const from = resolveTable(schema, input.fromTable, ["fromTable"]);
  if (!from.isOk) {
    return from;
  }
  const to = resolveTable(schema, input.toTable, ["toTable"]);
  return to.isOk ? ok({ from: from.value, to: to.value }) : to;
}

// A builder error names a table (a missing primary key) or something inside
// the relation; the former is reported at that table.
function failBuild(
  error: OperationError,
  ends: RelationEnds,
  at: string,
): Result<never, readonly AiEditError[]> {
  const [field] = error.path;
  if (field === "fromTableId" || field === "leftTableId") {
    return failWith(error.code, error.path, tableAt(ends.from.name));
  }
  if (field === "toTableId" || field === "rightTableId") {
    return failWith(error.code, error.path, tableAt(ends.to.name));
  }
  return failWith(error.code, error.path, at);
}

function pairColumns(
  fromIds: readonly ColumnId[],
  toIds: readonly ColumnId[],
): readonly ColumnPair[] | null {
  const pairs = fromIds.flatMap((fromColumnId, position) => {
    const toColumnId = toIds[position];
    return toColumnId === undefined ? [] : [{ fromColumnId, toColumnId }];
  });
  return fromIds.length === toIds.length ? pairs : null;
}

function translateManyToMany(
  schema: SchemaDocument,
  input: AddRelationInput,
  ends: RelationEnds,
  context: AiEditContext,
): Resolved<Translation> {
  const junctionTableName =
    input.junctionTable ??
    `${input.fromTable}${JUNCTION_NAME_SEPARATOR}${input.toTable}`;
  const at = relationAt(ends, undefined);
  const built = buildManyToMany(
    schema,
    {
      leftTableId: ends.from.id,
      rightTableId: ends.to.id,
      junctionTableName,
      position: aiTablePosition(context.placement),
    },
    context.generateId,
  );
  return built.isOk
    ? ok({ operation: built.value, at, placedTables: 1 })
    : failBuild(built.error, ends, at);
}

// Without fromColumns core creates the foreign key columns (buildRelation).
function translateBuiltRelation(
  schema: SchemaDocument,
  input: AddRelationInput & { readonly kind: Relation["kind"] },
  ends: RelationEnds,
  context: AiEditContext,
): Resolved<Translation> {
  const referenced =
    input.toColumns === undefined
      ? ok(undefined)
      : resolveColumns(schema, ends.to, input.toColumns, ["toColumns"]);
  if (!referenced.isOk) {
    return referenced;
  }
  const at = relationAt(ends, undefined);
  const built = buildRelation(
    schema,
    {
      fromTableId: ends.from.id,
      toTableId: ends.to.id,
      kind: input.kind,
      onDelete: input.onDelete ?? DEFAULT_REFERENTIAL_ACTION,
      onUpdate: input.onUpdate ?? DEFAULT_REFERENTIAL_ACTION,
      ...(referenced.value === undefined
        ? {}
        : { referencedColumnIds: referenced.value.map((column) => column.id) }),
    },
    context.generateId,
  );
  return built.isOk
    ? ok({ operation: built.value, at })
    : failBuild(built.error, ends, at);
}

type PairedRelationInput = AddRelationInput & {
  readonly kind: Relation["kind"];
  readonly fromColumns: readonly string[];
};

// Each fromColumns name is paired with toColumns, or else with the target's
// primary key, at the same position.
function resolveColumnPairs(
  schema: SchemaDocument,
  input: PairedRelationInput,
  ends: RelationEnds,
  at: string,
): Resolved<readonly ColumnPair[]> {
  const from = resolveColumns(schema, ends.from, input.fromColumns, [
    "fromColumns",
  ]);
  const to =
    input.toColumns === undefined
      ? ok(undefined)
      : resolveColumns(schema, ends.to, input.toColumns, ["toColumns"]);
  if (!from.isOk || !to.isOk) {
    return err([
      ...(from.isOk ? [] : from.error),
      ...(to.isOk ? [] : to.error),
    ]);
  }
  const toIds =
    to.value?.map((column) => column.id) ?? ends.to.primaryKeyColumnIds;
  if (toIds.length === 0) {
    return failWith("primary-key-missing", ["toTable"], tableAt(ends.to.name));
  }
  const fromIds = from.value.map((column) => column.id);
  const columnPairs = pairColumns(fromIds, toIds);
  return columnPairs === null
    ? failWith("relation-columns-mismatch", ["fromColumns"], at)
    : ok(columnPairs);
}

// With fromColumns the relation joins existing columns instead of new ones.
function translatePairedRelation(
  schema: SchemaDocument,
  input: PairedRelationInput,
  ends: RelationEnds,
  context: AiEditContext,
): Resolved<Translation> {
  const at = relationAt(ends, input.fromColumns);
  const columnPairs = resolveColumnPairs(schema, input, ends, at);
  if (!columnPairs.isOk) {
    return columnPairs;
  }
  const relation = {
    id: createRelationId(context.generateId),
    kind: input.kind,
    fromTableId: ends.from.id,
    toTableId: ends.to.id,
    columnPairs: columnPairs.value,
    onDelete: input.onDelete ?? DEFAULT_REFERENTIAL_ACTION,
    onUpdate: input.onUpdate ?? DEFAULT_REFERENTIAL_ACTION,
  };
  return ok({ operation: { type: "addRelation", relation }, at });
}

function translateAddRelation(
  schema: SchemaDocument,
  input: AddRelationInput,
  context: AiEditContext,
): Resolved<Translation> {
  const ends = resolveEnds(schema, input);
  if (!ends.isOk) {
    return ends;
  }
  const { kind, fromColumns } = input;
  if (kind === "manyToMany") {
    return translateManyToMany(schema, input, ends.value, context);
  }
  return fromColumns === undefined
    ? translateBuiltRelation(schema, { ...input, kind }, ends.value, context)
    : translatePairedRelation(
        schema,
        { ...input, kind, fromColumns },
        ends.value,
        context,
      );
}

// updateRelation and removeRelation find the one relation between the two
// tables, narrowed by fromColumns when given (AI-R9).
function findRelation(
  schema: SchemaDocument,
  input: AiEditInput<"removeRelation">,
): Resolved<{ readonly relation: Relation; readonly at: string }> {
  const ends = resolveEnds(schema, input);
  if (!ends.isOk) {
    return ends;
  }
  const fromColumns =
    input.fromColumns === undefined
      ? ok(null)
      : resolveColumns(schema, ends.value.from, input.fromColumns, [
          "fromColumns",
        ]);
  if (!fromColumns.isOk) {
    return fromColumns;
  }
  const at = relationAt(ends.value, input.fromColumns);
  const [relation, ...others] = findRelationsBetween(
    schema,
    ends.value.from,
    ends.value.to,
    fromColumns.value,
  );
  if (relation === undefined) {
    return failWith("relation-not-found", [], at);
  }
  return others.length > 0
    ? failWith("relation-ambiguous", [], at)
    : ok({ relation, at });
}

export function translateRelationEdit(
  schema: SchemaDocument,
  edit: RelationEdit,
  context: AiEditContext,
): Resolved<Translation> {
  if (edit.tool === "addRelation") {
    return translateAddRelation(schema, edit.input, context);
  }
  const found = findRelation(schema, edit.input);
  if (!found.isOk) {
    return found;
  }
  const { relation, at } = found.value;
  if (edit.tool === "removeRelation") {
    return ok({
      operation: { type: "removeRelation", relationId: relation.id },
      at,
    });
  }
  const { kind, onDelete, onUpdate } = edit.input;
  const changes = {
    ...(kind === undefined ? {} : { kind }),
    ...(onDelete === undefined ? {} : { onDelete }),
    ...(onUpdate === undefined ? {} : { onUpdate }),
  };
  return ok({
    operation: { type: "updateRelation", relationId: relation.id, changes },
    at,
  });
}
