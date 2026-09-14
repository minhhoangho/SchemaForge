import { describe, expect, it } from "vitest";

import { PRODUCT_NAME } from "./index.js";

describe("PRODUCT_NAME", () => {
  it("is the product name", () => {
    expect(PRODUCT_NAME).toBe("SchemaForge");
  });
});
