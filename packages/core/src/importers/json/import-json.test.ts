import { describe, expect, it } from "vitest";

import { serializeSchemaDocument } from "../../model/serialize-schema-document.js";
import { buildSchema, makeNote, makeTable } from "../../testing/factories.js";
import { createImportTestOptions } from "../../testing/import-test-options.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { unwrapError, unwrapOk } from "../../testing/unwrap-result.js";
import {
  MAX_IMPORTED_ELEMENTS,
  MAX_IMPORT_SOURCE_LENGTH,
} from "../shared/import-limits.js";
import { importJson } from "./import-json.js";

const EMPTY_SCHEMA_SOURCE = serializeSchemaDocument(buildSchema({}));

function padToLength(source: string, length: number): string {
  return source + " ".repeat(length - source.length);
}

// Compact JSON: indented, 20 000 notes would pass the source length limit.
function createNotesSource(count: number): string {
  const notes = Array.from({ length: count }, (_, index) =>
    makeNote({ id: `note_${String(index)}` }),
  );
  return JSON.stringify(buildSchema({ notes }));
}

// A table keyed by "__proto__" next to its own id; JSON.parse keeps the key as
// a genuine own property.
const PROTO_TABLE_SOURCE = serializeSchemaDocument(
  buildSchema({ tables: [makeTable({ id: "tbl_other" })] }),
).replace('"tbl_other": {', '"__proto__": {');

const PROTO_ROOT_SOURCE = EMPTY_SCHEMA_SOURCE.replace(
  "{",
  '{"__proto__": {"polluted": true},',
);

describe("importJson", () => {
  it("imports a file written by serializeSchemaDocument byte for byte", () => {
    const schema = createSampleSchema();
    const source = serializeSchemaDocument(schema);

    const imported = unwrapOk(importJson(source, createImportTestOptions()));

    expect(serializeSchemaDocument(imported.document)).toBe(source);
  });

  it("returns the document unchanged with no diagnostics", () => {
    const schema = createSampleSchema();

    expect(
      unwrapOk(
        importJson(serializeSchemaDocument(schema), createImportTestOptions()),
      ),
    ).toStrictEqual({ document: schema, diagnostics: [] });
  });

  it("reports syntax-error with line and column", () => {
    const source = '{\n  "version": 1,\n  "name" "x"\n}';

    expect(
      unwrapError(importJson(source, createImportTestOptions())),
    ).toStrictEqual({
      diagnostics: [
        { code: "syntax-error", location: { line: 3, column: 10 }, path: null },
      ],
    });
  });

  it.each([
    [
      "an id that differs from its map key",
      serializeSchemaDocument(
        buildSchema({ tables: [makeTable({ id: "tbl_b" })] }),
      ).replace('"tbl_b": {', '"tbl_a": {'),
      [
        {
          code: "id-mismatch",
          location: null,
          path: ["tables", "tbl_a", "id"],
        },
      ],
    ],
    [
      "a root value that is not an object",
      "[]",
      [{ code: "invalid-shape", location: null, path: ["version"] }],
    ],
  ])(
    "keeps the structural error code and path of parseSchemaDocument for %s",
    (_name, source, diagnostics) => {
      expect(
        unwrapError(importJson(source, createImportTestOptions())),
      ).toStrictEqual({ diagnostics });
    },
  );

  it("reports version-unsupported for a future version", () => {
    const source = EMPTY_SCHEMA_SOURCE.replace(
      /"version": \d+/u,
      '"version": 999',
    );

    expect(
      unwrapError(importJson(source, createImportTestOptions())),
    ).toStrictEqual({
      diagnostics: [
        { code: "version-unsupported", location: null, path: ["version"] },
      ],
    });
  });

  it("rejects a source one code unit over the limit", () => {
    const source = padToLength(
      EMPTY_SCHEMA_SOURCE,
      MAX_IMPORT_SOURCE_LENGTH + 1,
    );

    expect(
      unwrapError(importJson(source, createImportTestOptions())),
    ).toStrictEqual({
      diagnostics: [{ code: "source-too-large", location: null, path: null }],
    });
  });

  it("accepts a source exactly at the limit", () => {
    const source = padToLength(EMPTY_SCHEMA_SOURCE, MAX_IMPORT_SOURCE_LENGTH);

    expect(
      unwrapOk(importJson(source, createImportTestOptions())),
    ).toStrictEqual({ document: buildSchema({}), diagnostics: [] });
  });

  it("reports too-many-elements", () => {
    const source = createNotesSource(MAX_IMPORTED_ELEMENTS + 1);

    expect(
      unwrapError(importJson(source, createImportTestOptions())),
    ).toStrictEqual({
      diagnostics: [{ code: "too-many-elements", location: null, path: null }],
    });
  });

  // Checking the shape and invariants of every element is the costly part, so
  // the count comes first, on the parsed JSON.
  it("reports too-many-elements before checking the shape of the elements", () => {
    const notes = Object.fromEntries(
      Array.from({ length: MAX_IMPORTED_ELEMENTS + 1 }, (_, index) => [
        `note_${String(index)}`,
        0,
      ]),
    );
    const source = JSON.stringify({ ...buildSchema({}), notes });

    expect(
      unwrapError(importJson(source, createImportTestOptions())),
    ).toStrictEqual({
      diagnostics: [{ code: "too-many-elements", location: null, path: null }],
    });
  });

  it("accepts exactly the maximum number of elements", () => {
    const source = createNotesSource(MAX_IMPORTED_ELEMENTS);

    expect(
      unwrapOk(importJson(source, createImportTestOptions())).diagnostics,
    ).toStrictEqual([]);
  });

  it.each([
    [
      "a map key",
      PROTO_TABLE_SOURCE,
      [
        {
          code: "invalid-shape",
          location: null,
          path: ["tables", "__proto__"],
        },
      ],
    ],
    [
      "a root key",
      PROTO_ROOT_SOURCE,
      [{ code: "invalid-shape", location: null, path: ["__proto__"] }],
    ],
  ])(
    "rejects __proto__ keys without touching Object.prototype: %s",
    (_name, source, diagnostics) => {
      const prototypeNames = Object.getOwnPropertyNames(Object.prototype);

      const result = importJson(source, createImportTestOptions());

      expect(unwrapError(result)).toStrictEqual({ diagnostics });
      expect(Object.prototype).not.toHaveProperty("polluted");
      expect(Object.getOwnPropertyNames(Object.prototype)).toStrictEqual(
        prototypeNames,
      );
    },
  );
});
