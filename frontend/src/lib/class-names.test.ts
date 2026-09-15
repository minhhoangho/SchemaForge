import { describe, expect, it } from "vitest";

import { cn } from "./class-names";

describe("cn", () => {
  it("lets the last conflicting tailwind class win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("drops falsy class values", () => {
    expect(cn("flex", false, null, undefined, "", 0, "items-center")).toBe(
      "flex items-center",
    );
  });
});
