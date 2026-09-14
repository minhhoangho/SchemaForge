import { describe, expect, it } from "vitest";

import { noteShape } from "./note.js";

describe("noteShape", () => {
  it("accepts a note with text and a position", () => {
    const note = {
      id: "note_1",
      text: "Posts are soft-deleted",
      position: { x: 40, y: -80 },
    };

    expect(noteShape.safeParse(note).data).toStrictEqual(note);
  });

  it("rejects a note without a position", () => {
    expect(
      noteShape.safeParse({ id: "note_1", text: "Posts are soft-deleted" })
        .success,
    ).toBe(false);
  });
});
