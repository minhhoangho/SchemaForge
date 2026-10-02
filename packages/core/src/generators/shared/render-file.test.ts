import { describe, expect, it } from "vitest";

import { renderFileContent } from "./render-file.js";

describe("renderFileContent", () => {
  it("joins the lines of one block and ends with one newline", () => {
    expect(renderFileContent([["CREATE TABLE a (", "  id int", ");"]])).toBe(
      "CREATE TABLE a (\n  id int\n);\n",
    );
  });

  it("separates blocks with one blank line", () => {
    expect(renderFileContent([["first"], ["second"]])).toBe(
      "first\n\nsecond\n",
    );
  });

  it("skips empty blocks", () => {
    expect(renderFileContent([[], ["first"], [], ["second"], []])).toBe(
      "first\n\nsecond\n",
    );
  });

  it("returns a single newline when there are no blocks", () => {
    expect(renderFileContent([])).toBe("\n");
  });

  it("collapses trailing newlines at the end into one", () => {
    expect(renderFileContent([["first"], ["second", "", "\n"]])).toBe(
      "first\n\nsecond\n",
    );
  });
});
