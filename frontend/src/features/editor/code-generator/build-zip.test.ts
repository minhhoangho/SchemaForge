import { strFromU8, strToU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { buildZip } from "./build-zip";
import type { ZipEntry } from "./build-zip";

function text(fileName: string, content: string): ZipEntry {
  return { fileName, bytes: strToU8(content), isCompressed: true };
}

function header(zip: Uint8Array): DataView {
  return new DataView(zip.buffer, zip.byteOffset);
}

describe("buildZip", () => {
  it("stores files in name order", () => {
    const zip = buildZip([text("b.sql", "b"), text("a.json", "a")]);
    const files = unzipSync(zip);
    expect(Object.keys(files)).toStrictEqual(["a.json", "b.sql"]);
    expect(strFromU8(files["b.sql"] ?? new Uint8Array())).toBe("b");
  });

  it("sets every modification time to 1980-01-01", () => {
    const zip = buildZip([text("a.txt", "a")]);
    // Local header offsets 10 and 12: DOS time 00:00:00 and date 1980-01-01.
    expect(header(zip).getUint16(10, true)).toBe(0);
    expect(header(zip).getUint16(12, true)).toBe(0x0021);
  });

  it("gives identical bytes for the same entries", () => {
    const entries = [text("b.sql", "create table b;"), text("a.json", "{}")];
    expect(buildZip(entries)).toStrictEqual(buildZip([...entries].reverse()));
  });

  it("stores png entries without compression", () => {
    const bytes = new Uint8Array(2000);
    const zip = buildZip([{ fileName: "a.png", bytes, isCompressed: false }]);
    // Local header offset 8: compression method 0 means stored.
    expect(header(zip).getUint16(8, true)).toBe(0);
    expect(zip.length).toBeGreaterThan(bytes.length);
  });
});
