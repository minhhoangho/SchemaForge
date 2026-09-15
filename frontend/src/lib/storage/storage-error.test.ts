import { Dexie } from "dexie";
import { describe, expect, it } from "vitest";

import { getStorageErrorName, toStorageErrorCode } from "./storage-error";
import type { StorageErrorCode } from "./storage-error";

type ErrorLike = { readonly name: string; inner: unknown };

function createDomException(name: string): DOMException {
  return new DOMException("Storage failed", name);
}

function wrapInAbortErrors(error: unknown, levels: number): unknown {
  if (levels === 0) {
    return error;
  }
  return wrapInAbortErrors({ name: "AbortError", inner: error }, levels - 1);
}

describe("toStorageErrorCode", () => {
  it.each<[string, StorageErrorCode, unknown]>([
    [
      "QuotaExceededError",
      "quota-exceeded",
      createDomException("QuotaExceededError"),
    ],
    ["MissingAPIError", "unavailable", { name: "MissingAPIError" }],
    ["OpenFailedError", "unavailable", { name: "OpenFailedError" }],
    [
      "InvalidStateError",
      "unavailable",
      createDomException("InvalidStateError"),
    ],
    ["VersionError", "outdated-tab", createDomException("VersionError")],
    ["DatabaseClosedError", "closed", { name: "DatabaseClosedError" }],
    ["ConstraintError", "unknown", createDomException("ConstraintError")],
    ["Error", "unknown", new Error("Storage failed")],
  ])("maps %s to %s", (_name, expectedCode, error) => {
    expect(toStorageErrorCode(error)).toBe(expectedCode);
  });

  it("finds a QuotaExceededError nested in inner", () => {
    const error = new Dexie.AbortError(
      "Transaction aborted",
      createDomException("QuotaExceededError"),
    );

    expect(toStorageErrorCode(error)).toBe("quota-exceeded");
  });

  it("maps a real Dexie MissingAPIError to unavailable", () => {
    const error = new Dexie.MissingAPIError("IndexedDB API missing");

    expect(toStorageErrorCode(error)).toBe("unavailable");
  });

  it("prefers outdated-tab when an OpenFailedError wraps a VersionError", () => {
    const error = new Dexie.OpenFailedError(createDomException("VersionError"));

    expect(toStorageErrorCode(error)).toBe("outdated-tab");
  });

  it("prefers quota-exceeded over every other code in the chain", () => {
    const error = {
      name: "DatabaseClosedError",
      inner: {
        name: "VersionError",
        inner: createDomException("QuotaExceededError"),
      },
    };

    expect(toStorageErrorCode(error)).toBe("quota-exceeded");
  });

  it("stops following inner errors after the maximum depth", () => {
    const first: ErrorLike = { name: "AbortError", inner: null };
    const second: ErrorLike = { name: "UnknownError", inner: first };
    first.inner = second;

    expect(toStorageErrorCode(first)).toBe("unknown");
  });

  it.each<[number, StorageErrorCode]>([
    [5, "quota-exceeded"],
    [6, "unknown"],
  ])(
    "maps a QuotaExceededError nested %i levels deep to %s",
    (levels, expectedCode) => {
      const error = wrapInAbortErrors(
        createDomException("QuotaExceededError"),
        levels,
      );

      expect(toStorageErrorCode(error)).toBe(expectedCode);
    },
  );

  it.each<[string, unknown]>([
    ["null", null],
    ["a string", "QuotaExceededError"],
    ["a number", 42],
  ])("returns unknown for %s", (_description, error) => {
    expect(toStorageErrorCode(error)).toBe("unknown");
  });
});

describe("getStorageErrorName", () => {
  it("reads the outermost error name for logging", () => {
    const error = new Dexie.OpenFailedError(createDomException("VersionError"));

    expect(getStorageErrorName(error)).toBe("OpenFailedError");
  });

  it("returns UnknownError for a value without a name", () => {
    expect(getStorageErrorName("QuotaExceededError")).toBe("UnknownError");
  });
});
