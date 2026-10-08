import { describe, expect, it, vi } from "vitest";

import {
  MAX_IMPORT_FILE_BYTES,
  checkPastedSource,
  guessImportFormat,
  readImportFile,
} from "./decode-import-file";

const BYTE_MASK = 0xff;
const BYTE_BITS = 8;

function toUtf16Bytes(text: string, isLittleEndian: boolean): number[] {
  const bom = isLittleEndian ? [0xff, 0xfe] : [0xfe, 0xff];
  const units = Array.from({ length: text.length }, (_value, index) =>
    text.charCodeAt(index),
  ).flatMap((unit) => {
    const high = unit >> BYTE_BITS;
    const low = unit & BYTE_MASK;
    return isLittleEndian ? [low, high] : [high, low];
  });
  return [...bom, ...units];
}

function fileOf(bytes: readonly number[], name = "a.sql"): File {
  return new File([new Uint8Array(bytes)], name);
}

const encoder = new TextEncoder();

describe("readImportFile", () => {
  it("rejects a file over 2 MiB without reading its bytes", async () => {
    const file = new File([new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)], "a.sql");
    const read = vi.spyOn(file, "arrayBuffer");

    const result = await readImportFile(file);

    expect(result).toStrictEqual({ isOk: false, error: "too-large" });
    expect(read).not.toHaveBeenCalled();
  });

  it("accepts a file of exactly 2 MiB", async () => {
    const result = await readImportFile(
      new File([new Uint8Array(MAX_IMPORT_FILE_BYTES).fill(97)], "a.sql"),
    );

    expect(result.isOk).toBe(true);
  });

  it.each([
    ["without a byte order mark", [...encoder.encode("Tên é")]],
    ["with a byte order mark", [0xef, 0xbb, 0xbf, ...encoder.encode("Tên é")]],
  ])("decodes utf-8 %s", async (_name, bytes) => {
    expect(await readImportFile(fileOf(bytes))).toStrictEqual({
      isOk: true,
      value: "Tên é",
    });
  });

  it.each([
    ["le", true],
    ["be", false],
  ])("decodes utf-16 %s with a byte order mark", async (_name, isLittle) => {
    const bytes = toUtf16Bytes("CREATE TABLE [Tên];", isLittle);

    expect(await readImportFile(fileOf(bytes))).toStrictEqual({
      isOk: true,
      value: "CREATE TABLE [Tên];",
    });
  });

  it("rejects invalid utf-8", async () => {
    expect(
      await readImportFile(fileOf([0x61, 0xff, 0xfe, 0x62])),
    ).toStrictEqual({ isOk: false, error: "encoding-unsupported" });
  });

  it("rejects utf-16 with an odd number of bytes", async () => {
    expect(await readImportFile(fileOf([0xff, 0xfe, 0x61]))).toStrictEqual({
      isOk: false,
      error: "encoding-unsupported",
    });
  });
});

describe("checkPastedSource", () => {
  it("accepts text and keeps it unchanged", () => {
    expect(checkPastedSource(" a ")).toStrictEqual({
      isOk: true,
      value: " a ",
    });
  });

  it("rejects empty and blank text", () => {
    expect(checkPastedSource(" \n\t")).toStrictEqual({
      isOk: false,
      error: "empty",
    });
  });

  it("rejects pasted text over the byte limit", () => {
    // Short in code units, long in bytes: two bytes per character.
    const text = "é".repeat(MAX_IMPORT_FILE_BYTES / 2 + 1);

    expect(checkPastedSource(text)).toStrictEqual({
      isOk: false,
      error: "too-large",
    });
  });

  it("rejects pasted text longer than the byte limit without encoding it", () => {
    const encode = vi.spyOn(TextEncoder.prototype, "encode");

    const result = checkPastedSource("a".repeat(MAX_IMPORT_FILE_BYTES + 1));

    expect(result).toStrictEqual({ isOk: false, error: "too-large" });
    expect(encode).not.toHaveBeenCalled();
    encode.mockRestore();
  });

  it("checks the length before trimming a huge text", () => {
    const trim = vi.spyOn(String.prototype, "trim");

    const result = checkPastedSource(" ".repeat(MAX_IMPORT_FILE_BYTES + 1));

    expect(result).toStrictEqual({ isOk: false, error: "too-large" });
    expect(trim).not.toHaveBeenCalled();
    trim.mockRestore();
  });
});

describe("guessImportFormat", () => {
  it.each([
    ["schema.sql", "sql"],
    ["SCHEMA.SQL", "sql"],
    ["schema.prisma", "prisma"],
    ["a.b.dbml", "dbml"],
    ["schema.json", "json"],
    ["notes.txt", null],
    ["noextension", null],
  ])("maps %s to %s", (fileName, expected) => {
    expect(guessImportFormat(fileName)).toBe(expected);
  });
});
