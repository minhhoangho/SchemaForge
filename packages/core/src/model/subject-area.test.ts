import { describe, expect, it } from "vitest";

import { subjectAreaShape } from "./subject-area.js";

const SUBJECT_AREA = { id: "area_1", name: "Billing" };

describe("subjectAreaShape", () => {
  it("accepts a subject area with an id and a name", () => {
    expect(subjectAreaShape.safeParse(SUBJECT_AREA).data).toStrictEqual(
      SUBJECT_AREA,
    );
  });

  it("rejects an extra field", () => {
    expect(
      subjectAreaShape.safeParse({ ...SUBJECT_AREA, tableIds: [] }).success,
    ).toBe(false);
  });
});
