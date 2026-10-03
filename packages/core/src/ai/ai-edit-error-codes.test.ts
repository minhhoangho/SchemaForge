import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-codes.js";
import { ISSUE_CODES } from "../validation/issue-codes.js";
import { AI_EDIT_ERROR_CODES } from "./ai-edit-error-codes.js";

describe("AI_EDIT_ERROR_CODES", () => {
  it("lists the AI edit error codes", () => {
    expect(AI_EDIT_ERROR_CODES).toStrictEqual([
      "table-name-not-found",
      "column-name-not-found",
      "enum-name-not-found",
      "index-name-not-found",
      "relation-ambiguous",
      "relation-columns-mismatch",
      "column-type-invalid",
      "default-value-invalid",
      "tool-call-limit",
      "turn-has-edits",
      "turn-has-sample-data",
      "findings-limit",
      "sample-rows-limit",
    ]);
  });

  it("shares no code with core error codes or issue codes", () => {
    const coreCodes = new Set<string>([...ERROR_CODES, ...ISSUE_CODES]);

    expect(
      AI_EDIT_ERROR_CODES.filter((code) => coreCodes.has(code)),
    ).toStrictEqual([]);
  });
});
