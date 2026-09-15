import { describe, expect, it } from "vitest";

import { buildSchema, makeNote } from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { applyNoteOperation } from "./note-operations.js";
import type { NoteOperation } from "./operation.js";

const NOTE_NOT_FOUND_CASES: readonly {
  readonly type: NoteOperation["type"];
  readonly operation: NoteOperation;
}[] = [
  {
    type: "updateNote",
    operation: {
      type: "updateNote",
      noteId: "note_missing",
      changes: { text: "final" },
    },
  },
  {
    type: "removeNote",
    operation: { type: "removeNote", noteId: "note_missing" },
  },
];

describe("applyNoteOperation with addNote", () => {
  it("adds a note", () => {
    const schema = buildSchema({});
    const note = makeNote({ id: "note_1", text: "draft" });

    const result = unwrapOk(
      applyNoteOperation(schema, { type: "addNote", note }),
    );

    expect(result.schema).toStrictEqual(buildSchema({ notes: [note] }));
  });

  it("returns removeNote as the inverse of addNote", () => {
    const schema = buildSchema({});
    const expectedInverse: NoteOperation = {
      type: "removeNote",
      noteId: "note_1",
    };

    const result = unwrapOk(
      applyNoteOperation(schema, {
        type: "addNote",
        note: makeNote({ id: "note_1" }),
      }),
    );

    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applyNoteOperation(result.schema, expectedInverse)).schema,
    ).toStrictEqual(schema);
  });

  it("rejects addNote with id-already-exists", () => {
    const schema = buildSchema({ notes: [makeNote({ id: "note_1" })] });

    const error = unwrapError(
      applyNoteOperation(schema, {
        type: "addNote",
        note: makeNote({ id: "note_1", text: "other" }),
      }),
    );

    expect(error).toStrictEqual({
      code: "id-already-exists",
      path: ["note", "id"],
    });
  });
});

describe("applyNoteOperation with updateNote", () => {
  it("changes the text of a note and returns the previous text as the inverse", () => {
    const note = makeNote({ id: "note_1", text: "draft" });
    const schema = buildSchema({ notes: [note] });
    const expectedInverse: NoteOperation = {
      type: "updateNote",
      noteId: "note_1",
      changes: { text: "draft" },
    };

    const result = unwrapOk(
      applyNoteOperation(schema, {
        type: "updateNote",
        noteId: "note_1",
        changes: { text: "final" },
      }),
    );

    expect(result.schema).toStrictEqual(
      buildSchema({ notes: [{ ...note, text: "final" }] }),
    );
    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applyNoteOperation(result.schema, expectedInverse)).schema,
    ).toStrictEqual(schema);
  });

  it("keeps other notes by reference when a note is updated", () => {
    const schema = buildSchema({
      notes: [makeNote({ id: "note_1" }), makeNote({ id: "note_2" })],
    });

    const result = unwrapOk(
      applyNoteOperation(schema, {
        type: "updateNote",
        noteId: "note_1",
        changes: { text: "final" },
      }),
    );

    expect(result.schema.notes.note_2).toBe(schema.notes.note_2);
  });

  it("returns the same schema reference when updateNote keeps the text", () => {
    const schema = buildSchema({
      notes: [makeNote({ id: "note_1", text: "draft" })],
    });

    const result = unwrapOk(
      applyNoteOperation(schema, {
        type: "updateNote",
        noteId: "note_1",
        changes: { text: "draft" },
      }),
    );

    expect(result.schema).toBe(schema);
  });
});

describe("applyNoteOperation with removeNote", () => {
  it("removes a note and returns addNote as the inverse", () => {
    const note = makeNote({ id: "note_1", text: "draft" });
    const schema = buildSchema({ notes: [note] });
    const expectedInverse: NoteOperation = { type: "addNote", note };

    const result = unwrapOk(
      applyNoteOperation(schema, { type: "removeNote", noteId: "note_1" }),
    );

    expect(result.schema).toStrictEqual(buildSchema({}));
    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applyNoteOperation(result.schema, expectedInverse)).schema,
    ).toStrictEqual(schema);
  });
});

describe("applyNoteOperation with a missing note", () => {
  it.each(NOTE_NOT_FOUND_CASES)(
    "rejects updateNote and removeNote with note-not-found ($type)",
    ({ operation }) => {
      const schema = buildSchema({});

      const error = unwrapError(applyNoteOperation(schema, operation));

      expect(error).toStrictEqual({ code: "note-not-found", path: ["noteId"] });
    },
  );
});
