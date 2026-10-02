import { describe, expect, it } from "vitest";

import {
  removeCombiningMarks,
  toPascalCaseIdentifier,
} from "../generators/shared/identifiers.js";
import { MAX_NAME_BYTES, utf8ByteLength } from "../model/name-limits.js";
import { parseSchemaDocument } from "../parse/parse-schema-document.js";
import { validateSchema } from "../validation/validate-schema.js";
import { createNamingEdgeSchema } from "./naming-edge-schema.js";
import { unwrapOk } from "./unwrap-result.js";

const SQL_QUOTE_CHARACTERS = ['"', "`", "]", "'", "\\"];

function listTableNames(): readonly string[] {
  return Object.values(createNamingEdgeSchema().tables).map(
    (table) => table.name,
  );
}

function containsEveryQuoteCharacter(name: string): boolean {
  return SQL_QUOTE_CHARACTERS.every((character) => name.includes(character));
}

describe("createNamingEdgeSchema", () => {
  it("has no semantic issues", () => {
    expect(validateSchema(createNamingEdgeSchema())).toStrictEqual([]);
  });

  it("returns structurally equal schemas on every call", () => {
    expect(createNamingEdgeSchema()).toStrictEqual(createNamingEdgeSchema());
  });

  it("passes parseSchemaDocument after JSON stringify and parse", () => {
    const schema = createNamingEdgeSchema();
    const roundTripped: unknown = JSON.parse(JSON.stringify(schema));

    expect(unwrapOk(parseSchemaDocument(roundTripped))).toStrictEqual(schema);
  });

  it("contains names with every quote character of the three sql dialects", () => {
    expect(listTableNames().filter(containsEveryQuoteCharacter)).toHaveLength(
      1,
    );
  });

  it("contains a table name of exactly 63 bytes", () => {
    expect(listTableNames().map(utf8ByteLength)).toContain(MAX_NAME_BYTES);
  });

  it("contains two table names that map to the same code identifier", () => {
    const tableNames = listTableNames();
    const identifiers = tableNames.map((name) =>
      toPascalCaseIdentifier(name, "Table"),
    );

    expect(new Set(identifiers).size).toBe(tableNames.length - 1);
  });

  it("contains column names that differ only by an accent", () => {
    const columns = Object.values(createNamingEdgeSchema().columns);
    const accentlessKeys = columns.map(
      (column) => `${column.tableId}/${removeCombiningMarks(column.name)}`,
    );

    expect(new Set(accentlessKeys).size).toBe(columns.length - 1);
  });

  it("contains a comment with a null character", () => {
    const comments = Object.values(createNamingEdgeSchema().columns).map(
      (column) => column.comment,
    );

    expect(comments).toContainEqual(expect.stringContaining("\u0000"));
  });

  it("contains two relations between the same pair of tables", () => {
    const relations = Object.values(createNamingEdgeSchema().relations);
    const tablePairs = relations.map(
      (relation) => `${relation.fromTableId}->${relation.toTableId}`,
    );

    expect(new Set(tablePairs).size).toBe(relations.length - 1);
  });
});
