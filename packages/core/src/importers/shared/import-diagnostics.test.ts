import { describe, expect, it } from "vitest";

import {
  createImportDiagnostic,
  finalizeImportDiagnostics,
} from "./import-diagnostics.js";

describe("createImportDiagnostic", () => {
  it("builds a diagnostic from a code, a location and a path", () => {
    expect(
      createImportDiagnostic("type-approximated", { line: 3, column: 5 }, [
        "columns",
        "col_1",
        "type",
      ]),
    ).toStrictEqual({
      code: "type-approximated",
      location: { line: 3, column: 5 },
      path: ["columns", "col_1", "type"],
    });
  });
});

describe("finalizeImportDiagnostics", () => {
  it("sorts by line, then column, then code, then path", () => {
    const diagnostics = [
      createImportDiagnostic("type-approximated", { line: 2, column: 1 }, [
        "columns",
        "col_2",
        "type",
      ]),
      createImportDiagnostic("type-approximated", { line: 2, column: 1 }, [
        "columns",
        "col_1",
        "type",
      ]),
      createImportDiagnostic("default-approximated", { line: 2, column: 1 }, [
        "columns",
        "col_9",
        "defaultValue",
      ]),
      createImportDiagnostic("syntax-error", { line: 1, column: 9 }, null),
      createImportDiagnostic("syntax-error", { line: 2, column: 0 }, null),
      createImportDiagnostic(
        "view-not-supported",
        { line: 1, column: 2 },
        null,
      ),
    ];

    expect(finalizeImportDiagnostics(diagnostics)).toStrictEqual([
      createImportDiagnostic(
        "view-not-supported",
        { line: 1, column: 2 },
        null,
      ),
      createImportDiagnostic("syntax-error", { line: 1, column: 9 }, null),
      createImportDiagnostic("syntax-error", { line: 2, column: 0 }, null),
      createImportDiagnostic("default-approximated", { line: 2, column: 1 }, [
        "columns",
        "col_9",
        "defaultValue",
      ]),
      createImportDiagnostic("type-approximated", { line: 2, column: 1 }, [
        "columns",
        "col_1",
        "type",
      ]),
      createImportDiagnostic("type-approximated", { line: 2, column: 1 }, [
        "columns",
        "col_2",
        "type",
      ]),
    ]);
  });

  it("puts a diagnostic without a path after one with a path", () => {
    const diagnostics = [
      createImportDiagnostic("comment-dropped", null, null),
      createImportDiagnostic("comment-dropped", null, ["enums", "enum_1"]),
    ];

    expect(finalizeImportDiagnostics(diagnostics)).toStrictEqual([
      createImportDiagnostic("comment-dropped", null, ["enums", "enum_1"]),
      createImportDiagnostic("comment-dropped", null, null),
    ]);
  });

  it("puts diagnostics without a location last", () => {
    const diagnostics = [
      createImportDiagnostic("parse-failed", null, null),
      createImportDiagnostic("syntax-error", { line: 40, column: 1 }, null),
    ];

    expect(finalizeImportDiagnostics(diagnostics)).toStrictEqual([
      createImportDiagnostic("syntax-error", { line: 40, column: 1 }, null),
      createImportDiagnostic("parse-failed", null, null),
    ]);
  });

  it("removes a repeated code, location and path", () => {
    const diagnostics = [
      createImportDiagnostic("namespace-dropped", { line: 1, column: 1 }, [
        "tables",
        "tbl_1",
      ]),
      createImportDiagnostic("namespace-dropped", { line: 1, column: 1 }, [
        "tables",
        "tbl_1",
      ]),
    ];

    expect(finalizeImportDiagnostics(diagnostics)).toStrictEqual([
      createImportDiagnostic("namespace-dropped", { line: 1, column: 1 }, [
        "tables",
        "tbl_1",
      ]),
    ]);
  });

  it("keeps the same code at two locations", () => {
    const diagnostics = [
      createImportDiagnostic(
        "view-not-supported",
        { line: 7, column: 1 },
        null,
      ),
      createImportDiagnostic(
        "view-not-supported",
        { line: 3, column: 1 },
        null,
      ),
    ];

    expect(finalizeImportDiagnostics(diagnostics)).toStrictEqual([
      createImportDiagnostic(
        "view-not-supported",
        { line: 3, column: 1 },
        null,
      ),
      createImportDiagnostic(
        "view-not-supported",
        { line: 7, column: 1 },
        null,
      ),
    ]);
  });

  it("returns an empty list for no diagnostics", () => {
    expect(finalizeImportDiagnostics([])).toStrictEqual([]);
  });
});
