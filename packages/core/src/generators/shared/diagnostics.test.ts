import { describe, expect, it } from "vitest";

import { createDiagnostic, finalizeDiagnostics } from "./diagnostics.js";

describe("finalizeDiagnostics", () => {
  it("sorts diagnostics by path, then by code", () => {
    const diagnostics = [
      createDiagnostic("default-omitted", ["columns", "col_b", "defaultValue"]),
      createDiagnostic("type-not-supported", ["columns", "col_a", "type"]),
      createDiagnostic("enum-not-supported", ["columns", "col_a", "type"]),
    ];

    expect(finalizeDiagnostics(diagnostics)).toStrictEqual([
      createDiagnostic("enum-not-supported", ["columns", "col_a", "type"]),
      createDiagnostic("type-not-supported", ["columns", "col_a", "type"]),
      createDiagnostic("default-omitted", ["columns", "col_b", "defaultValue"]),
    ]);
  });

  it("removes a repeated code and path pair", () => {
    const diagnostics = [
      createDiagnostic("referential-action-cycle", ["relations", "rel_1"]),
      createDiagnostic("referential-action-cycle", ["relations", "rel_1"]),
    ];

    expect(finalizeDiagnostics(diagnostics)).toStrictEqual([
      createDiagnostic("referential-action-cycle", ["relations", "rel_1"]),
    ]);
  });

  it("keeps the same code at two different paths", () => {
    const diagnostics = [
      createDiagnostic("referential-action-not-supported", [
        "relations",
        "rel_1",
        "onUpdate",
      ]),
      createDiagnostic("referential-action-not-supported", [
        "relations",
        "rel_1",
        "onDelete",
      ]),
    ];

    expect(finalizeDiagnostics(diagnostics)).toStrictEqual([
      createDiagnostic("referential-action-not-supported", [
        "relations",
        "rel_1",
        "onDelete",
      ]),
      createDiagnostic("referential-action-not-supported", [
        "relations",
        "rel_1",
        "onUpdate",
      ]),
    ]);
  });

  it("orders a numeric path segment before a string segment", () => {
    const diagnostics = [
      createDiagnostic("null-character-removed", ["enums", "enum_1", "name"]),
      createDiagnostic("null-character-removed", ["enums", "enum_1", 10]),
      createDiagnostic("null-character-removed", ["enums", "enum_1", 2]),
    ];

    expect(finalizeDiagnostics(diagnostics)).toStrictEqual([
      createDiagnostic("null-character-removed", ["enums", "enum_1", 2]),
      createDiagnostic("null-character-removed", ["enums", "enum_1", 10]),
      createDiagnostic("null-character-removed", ["enums", "enum_1", "name"]),
    ]);
  });

  it("returns an empty list for no diagnostics", () => {
    expect(finalizeDiagnostics([])).toStrictEqual([]);
  });
});
