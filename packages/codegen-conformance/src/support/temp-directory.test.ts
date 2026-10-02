import { access } from "node:fs/promises";
import { dirname } from "node:path";

import { describe, expect, it } from "vitest";

import { CONFORMANCE_TEMP_ROOT, withTempDirectory } from "./temp-directory.js";

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

describe("withTempDirectory", () => {
  it("creates a fresh directory inside the package temp root", async () => {
    await withTempDirectory(async (directory) => {
      expect(dirname(directory)).toBe(CONFORMANCE_TEMP_ROOT.replace(/\/$/, ""));
      expect(await exists(directory)).toBe(true);
    });
  });

  it("removes the directory after the callback resolves", async () => {
    const directory = await withTempDirectory((d) => Promise.resolve(d));
    expect(await exists(directory)).toBe(false);
  });

  it("removes the directory when the callback throws and rethrows the error", async () => {
    let created = "";
    await expect(
      withTempDirectory((d) => {
        created = d;
        return Promise.reject(new Error("boom"));
      }),
    ).rejects.toThrow("boom");
    expect(await exists(created)).toBe(false);
  });
});
