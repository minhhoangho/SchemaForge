import type { GenerateId } from "../model/ids.js";
import { createEnumId, createIndexId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { applyOperation } from "../operations/apply-operation.js";
import type { Operation } from "../operations/operation.js";
import { suggestIndexName } from "../operations/suggest-index-name.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import { findIntroducedIssues } from "../validation/find-introduced-issues.js";
import type { AiEditError } from "./ai-edit-error-codes.js";
import { translateRelationEdit } from "./ai-edit-relations.js";
import type {
  AiEditContext,
  Resolved,
  Translation,
} from "./ai-edit-resolve.js";
import {
  enumAt,
  failWith,
  resolveColumns,
  resolveEnumId,
  resolveTable,
  tableAt,
} from "./ai-edit-resolve.js";
import {
  translateAddColumn,
  translateColumnEdit,
  translateCreateTable,
  translateTableEdit,
  translateUpdateColumn,
} from "./ai-edit-tables.js";
import type { AiEdit, AiEditInput } from "./ai-edit-tools.js";
import { describePathForAi, formatAiName } from "./describe-path-for-ai.js";
import { findIndexByName } from "./resolve-ai-names.js";

export type { AiEditContext } from "./ai-edit-resolve.js";

export type AiEditSuccess = {
  readonly schema: SchemaDocument;
  readonly operation: Operation;
  readonly placedTables: number;
};

function translateAddIndex(
  schema: SchemaDocument,
  input: AiEditInput<"addIndex">,
  generateId: GenerateId,
): Resolved<Translation> {
  const table = resolveTable(schema, input.table, ["table"]);
  if (!table.isOk) {
    return table;
  }
  const columns = resolveColumns(schema, table.value, input.columns, [
    "columns",
  ]);
  if (!columns.isOk) {
    return columns;
  }
  const name =
    input.name ??
    suggestIndexName(schema, {
      tableName: table.value.name,
      columnNames: columns.value.map((column) => column.name),
      isUnique: input.isUnique,
    });
  const index = {
    id: createIndexId(generateId),
    tableId: table.value.id,
    name,
    columnIds: columns.value.map((column) => column.id),
    isUnique: input.isUnique,
  };
  return ok({
    operation: { type: "addIndex", index },
    at: `${tableAt(table.value.name)}.indexes.${formatAiName(name)}`,
  });
}

function translateRemoveIndex(
  schema: SchemaDocument,
  input: AiEditInput<"removeIndex">,
): Resolved<Translation> {
  const table = resolveTable(schema, input.table, ["table"]);
  if (!table.isOk) {
    return table;
  }
  const at = `${tableAt(table.value.name)}.indexes.${formatAiName(input.index)}`;
  const index = findIndexByName(schema, table.value, input.index);
  return index === null
    ? failWith("index-name-not-found", ["index"], at)
    : ok({ operation: { type: "removeIndex", indexId: index.id }, at });
}

function translateEnumEdit(
  schema: SchemaDocument,
  edit: Extract<AiEdit, { tool: "updateEnum" | "removeEnum" }>,
): Resolved<Translation> {
  const enumId = resolveEnumId(schema, edit.input.enum);
  if (!enumId.isOk) {
    return enumId;
  }
  const at = enumAt(edit.input.enum);
  if (edit.tool === "removeEnum") {
    return ok({ operation: { type: "removeEnum", enumId: enumId.value }, at });
  }
  const { newName, values } = edit.input;
  const changes = {
    ...(newName === undefined ? {} : { name: newName }),
    ...(values === undefined ? {} : { values }),
  };
  return ok({
    operation: { type: "updateEnum", enumId: enumId.value, changes },
    at,
  });
}

function translate(
  schema: SchemaDocument,
  edit: AiEdit,
  context: AiEditContext,
): Resolved<Translation> {
  switch (edit.tool) {
    case "renameSchema":
      return ok({
        operation: { type: "renameSchema", name: edit.input.name },
        at: "name",
      });
    case "createTable":
      return translateCreateTable(schema, edit.input, context);
    case "updateTable":
    case "removeTable":
    case "setPrimaryKey":
      return translateTableEdit(schema, edit);
    case "addColumn":
      return translateAddColumn(schema, edit.input, context.generateId);
    case "updateColumn":
      return translateUpdateColumn(schema, edit.input);
    case "removeColumn":
      return translateColumnEdit(schema, edit.input);
    case "addIndex":
      return translateAddIndex(schema, edit.input, context.generateId);
    case "removeIndex":
      return translateRemoveIndex(schema, edit.input);
    case "createEnum": {
      const { name, values } = edit.input;
      const id = createEnumId(context.generateId);
      return ok({
        operation: { type: "addEnum", enum: { id, name, values } },
        at: enumAt(name),
      });
    }
    case "updateEnum":
    case "removeEnum":
      return translateEnumEdit(schema, edit);
    case "addRelation":
    case "updateRelation":
    case "removeRelation":
      return translateRelationEdit(schema, edit, context);
    default: {
      const unhandled: never = edit;
      throw new Error(`Unhandled AI edit: ${JSON.stringify(unhandled)}`);
    }
  }
}

/**
 * Translates one AI tool call, which names elements rather than ids, into a
 * core operation and applies it in strict mode (AI-R10, AI-R15): name
 * translation, applyOperation, then findIntroducedIssues. Any error returns
 * `err` and no document; `schema` is never mutated.
 */
export function applyAiEdit(
  schema: SchemaDocument,
  edit: AiEdit,
  context: AiEditContext,
): Result<AiEditSuccess, readonly AiEditError[]> {
  const translated = translate(schema, edit, context);
  if (!translated.isOk) {
    return translated;
  }
  const { operation, at, placedTables = 0 } = translated.value;
  const applied = applyOperation(schema, operation);
  if (!applied.isOk) {
    return failWith(applied.error.code, applied.error.path, at);
  }
  const result = applied.value.schema;
  const issues = findIntroducedIssues(schema, result);
  if (issues.length > 0) {
    return err(
      issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        at: describePathForAi(result, issue.path),
      })),
    );
  }
  return ok({ schema: result, operation, placedTables });
}
