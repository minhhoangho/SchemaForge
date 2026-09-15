import { sortByPathThenCode } from "../../document-path.js";
import type { DocumentPath } from "../../document-path.js";
import type { Column } from "../../model/column.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Issue } from "../issue-codes.js";

import { isValidDefaultLiteral } from "./default-literals.js";

const TIMESTAMP_KINDS = new Set(["timestamp", "timestamptz"]);

function checkExpressionDefault(
  columnTypeKind: Column["type"]["kind"],
  expressionKind: "currentTimestamp" | "generateUuid",
  path: DocumentPath,
): readonly Issue[] {
  const isCompatible =
    expressionKind === "currentTimestamp"
      ? TIMESTAMP_KINDS.has(columnTypeKind)
      : columnTypeKind === "uuid";
  return isCompatible ? [] : [{ code: "column-default-incompatible", path }];
}

function checkLiteralDefault(
  schema: SchemaDocument,
  column: Column,
  value: string,
  path: DocumentPath,
): readonly Issue[] {
  if (column.type.kind === "binary") {
    return [{ code: "column-default-incompatible", path }];
  }
  return isValidDefaultLiteral(column.type, value, schema.enums)
    ? []
    : [{ code: "column-default-invalid", path }];
}

function checkColumnDefault(
  schema: SchemaDocument,
  column: Column,
): readonly Issue[] {
  const defaultValue = column.defaultValue;
  if (defaultValue === null) {
    return [];
  }
  const path: DocumentPath = ["columns", column.id, "defaultValue"];
  if (defaultValue.kind === "literal") {
    return checkLiteralDefault(schema, column, defaultValue.value, path);
  }
  return checkExpressionDefault(column.type.kind, defaultValue.kind, path);
}

/** Validates every column's default value against its column type (spec section 3). */
export function validateColumnDefaults(
  schema: SchemaDocument,
): readonly Issue[] {
  const issues = Object.values(schema.columns).flatMap((column) =>
    checkColumnDefault(schema, column),
  );
  return sortByPathThenCode(issues);
}
