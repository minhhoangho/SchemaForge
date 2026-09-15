import { describe, expect, it } from "vitest";

import type { Position } from "../model/position.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { buildSchema, makeNote, makeTable } from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { applyMoveElements } from "./move-elements.js";
import type { OperationOfType } from "./operation.js";

type LayoutPositions = {
  readonly users?: Position;
  readonly orders?: Position;
  readonly note?: Position;
};

// Two tables and one note; each position can be overridden to build the
// expected schema after a move.
function buildLayoutSchema(positions: LayoutPositions = {}): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        position: positions.users ?? { x: 0, y: 0 },
      }),
      makeTable({
        id: "tbl_orders",
        position: positions.orders ?? { x: 100, y: 0 },
      }),
    ],
    notes: [
      makeNote({ id: "note_1", position: positions.note ?? { x: 0, y: 100 } }),
    ],
  });
}

describe("applyMoveElements", () => {
  it("moves tables and notes in one operation", () => {
    const schema = buildLayoutSchema();

    const result = unwrapOk(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [
          { elementId: "tbl_users", position: { x: 10, y: 20 } },
          { elementId: "note_1", position: { x: 30, y: 40 } },
        ],
      }),
    );

    expect(result.schema).toStrictEqual(
      buildLayoutSchema({ users: { x: 10, y: 20 }, note: { x: 30, y: 40 } }),
    );
  });

  it("returns moveElements with previous positions in the same order as the inverse", () => {
    const schema = buildLayoutSchema();

    const result = unwrapOk(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [
          { elementId: "note_1", position: { x: 1, y: 1 } },
          { elementId: "tbl_orders", position: { x: 2, y: 2 } },
          { elementId: "tbl_users", position: { x: 3, y: 3 } },
        ],
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "moveElements",
      moves: [
        { elementId: "note_1", position: { x: 0, y: 100 } },
        { elementId: "tbl_orders", position: { x: 100, y: 0 } },
        { elementId: "tbl_users", position: { x: 0, y: 0 } },
      ],
    });
  });

  it("restores every position when the inverse is applied", () => {
    const schema = buildLayoutSchema();
    const expectedInverse: OperationOfType<"moveElements"> = {
      type: "moveElements",
      moves: [
        { elementId: "tbl_users", position: { x: 0, y: 0 } },
        { elementId: "note_1", position: { x: 0, y: 100 } },
      ],
    };

    const result = unwrapOk(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [
          { elementId: "tbl_users", position: { x: 10, y: 20 } },
          { elementId: "note_1", position: { x: 30, y: 40 } },
        ],
      }),
    );

    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applyMoveElements(result.schema, expectedInverse)).schema,
    ).toStrictEqual(schema);
  });

  it("applies the last move when an element appears twice", () => {
    const schema = buildLayoutSchema();

    const result = unwrapOk(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [
          { elementId: "tbl_users", position: { x: 10, y: 10 } },
          { elementId: "tbl_users", position: { x: 20, y: 20 } },
        ],
      }),
    );

    expect(result.schema).toStrictEqual(
      buildLayoutSchema({ users: { x: 20, y: 20 } }),
    );
  });

  it("restores the original position after moving an element twice", () => {
    const schema = buildLayoutSchema();
    const expectedInverse: OperationOfType<"moveElements"> = {
      type: "moveElements",
      moves: [
        { elementId: "tbl_users", position: { x: 0, y: 0 } },
        { elementId: "tbl_users", position: { x: 0, y: 0 } },
      ],
    };

    const result = unwrapOk(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [
          { elementId: "tbl_users", position: { x: 10, y: 10 } },
          { elementId: "tbl_users", position: { x: 20, y: 20 } },
        ],
      }),
    );

    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applyMoveElements(result.schema, expectedInverse)).schema,
    ).toStrictEqual(schema);
  });

  it("returns the same schema reference when an element is moved away and back in one operation", () => {
    const schema = buildLayoutSchema();

    const result = unwrapOk(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [
          { elementId: "tbl_users", position: { x: 10, y: 10 } },
          { elementId: "tbl_users", position: { x: 0, y: 0 } },
        ],
      }),
    );

    expect(result.schema).toBe(schema);
  });

  it("rejects a missing table with table-not-found at the move index", () => {
    const schema = buildLayoutSchema();

    const error = unwrapError(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [
          { elementId: "tbl_users", position: { x: 10, y: 10 } },
          { elementId: "tbl_missing", position: { x: 20, y: 20 } },
        ],
      }),
    );

    expect(error).toStrictEqual({
      code: "table-not-found",
      path: ["moves", 1, "elementId"],
    });
  });

  it("rejects a missing note with note-not-found", () => {
    const schema = buildLayoutSchema();

    const error = unwrapError(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [{ elementId: "note_missing", position: { x: 10, y: 10 } }],
      }),
    );

    expect(error).toStrictEqual({
      code: "note-not-found",
      path: ["moves", 0, "elementId"],
    });
  });

  it("returns the same schema reference for an empty move list", () => {
    const schema = buildLayoutSchema();

    const result = unwrapOk(
      applyMoveElements(schema, { type: "moveElements", moves: [] }),
    );

    expect(result.schema).toBe(schema);
  });

  it("returns the same schema reference when every position is unchanged", () => {
    const schema = buildLayoutSchema();

    const result = unwrapOk(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [
          { elementId: "tbl_users", position: { x: 0, y: 0 } },
          { elementId: "note_1", position: { x: 0, y: 100 } },
        ],
      }),
    );

    expect(result.schema).toBe(schema);
  });

  it("keeps unmoved tables by reference", () => {
    const schema = buildLayoutSchema();

    const result = unwrapOk(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [{ elementId: "tbl_users", position: { x: 10, y: 10 } }],
      }),
    );

    expect(result.schema.tables.tbl_orders).toBe(schema.tables.tbl_orders);
  });

  it("keeps the notes map by reference when only tables move", () => {
    const schema = buildLayoutSchema();

    const result = unwrapOk(
      applyMoveElements(schema, {
        type: "moveElements",
        moves: [{ elementId: "tbl_users", position: { x: 10, y: 10 } }],
      }),
    );

    expect(result.schema.notes).toBe(schema.notes);
  });
});
