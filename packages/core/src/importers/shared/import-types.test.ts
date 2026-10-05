import { describe, expect, expectTypeOf, it } from "vitest";

import type { StructuralErrorCode } from "../../error-codes.js";
import type { ImportDiagnosticCode } from "./import-diagnostic-codes.js";
import type { ImportDiagnostic } from "./import-types.js";
import { IMPORT_FORMATS } from "./import-types.js";

describe("import types", () => {
  it("lists the six import formats in spec order", () => {
    expect(IMPORT_FORMATS).toStrictEqual([
      "postgresql",
      "mysql",
      "sqlserver",
      "prisma",
      "dbml",
      "json",
    ]);
  });

  it("allows structural error codes in an import diagnostic for the json importer", () => {
    expectTypeOf<ImportDiagnostic["code"]>().toEqualTypeOf<
      ImportDiagnosticCode | StructuralErrorCode
    >();
  });
});
