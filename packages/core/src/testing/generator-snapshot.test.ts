import { describe, expect, it } from "vitest";

import { formatDiagnosticsSnapshot } from "./generator-snapshot.js";

describe("formatDiagnosticsSnapshot", () => {
  it("formats one diagnostic per line as code and json path", () => {
    const snapshot = formatDiagnosticsSnapshot([
      { code: "type-not-supported", path: ["columns", "col_1", "type"] },
      {
        code: "null-character-removed",
        path: ["enums", "enum_1", "values", 0],
      },
    ]);

    expect(snapshot).toBe(
      'type-not-supported ["columns","col_1","type"]\n' +
        'null-character-removed ["enums","enum_1","values",0]\n',
    );
  });

  it("writes (none) when there are no diagnostics", () => {
    expect(formatDiagnosticsSnapshot([])).toBe("(none)\n");
  });
});
