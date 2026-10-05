import { describe, expectTypeOf, it } from "vitest";

import type { ColumnType } from "../../model/column-type.js";
import type { DraftColumnType, DraftNote } from "./import-draft.js";

describe("import draft", () => {
  it("references an enum by name instead of by id", () => {
    expectTypeOf<
      Extract<DraftColumnType, { readonly kind: "enum" }>
    >().toEqualTypeOf<{ readonly kind: "enum"; readonly enumName: string }>();
  });

  it("keeps every non-enum column type of the model", () => {
    expectTypeOf<
      Exclude<DraftColumnType, { readonly kind: "enum" }>
    >().toEqualTypeOf<Exclude<ColumnType, { readonly kind: "enum" }>>();
  });

  it("names the note body text like the model", () => {
    expectTypeOf<DraftNote["text"]>().toEqualTypeOf<string>();
  });
});
