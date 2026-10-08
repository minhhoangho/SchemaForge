export const MAX_IMPORT_FILE_BYTES = 2_097_152;

export type DecodeResult<E extends string> =
  | { readonly isOk: true; readonly value: string }
  | { readonly isOk: false; readonly error: E };

export type ImportFileFormat = "sql" | "prisma" | "dbml" | "json";

const UTF8_BOM_LENGTH = 3;
const UTF16_BOM_LENGTH = 2;
const UTF16_BYTES_PER_UNIT = 2;

const EXTENSION_FORMATS = new Map<string, ImportFileFormat>([
  ["sql", "sql"],
  ["prisma", "prisma"],
  ["dbml", "dbml"],
  ["json", "json"],
]);

function pickDecoder(bytes: Uint8Array): {
  readonly label: "utf-8" | "utf-16le" | "utf-16be";
  readonly bomLength: number;
} {
  const [first, second, third] = bytes;
  if (first === 0xef && second === 0xbb && third === 0xbf) {
    return { label: "utf-8", bomLength: UTF8_BOM_LENGTH };
  }
  if (first === 0xff && second === 0xfe) {
    return { label: "utf-16le", bomLength: UTF16_BOM_LENGTH };
  }
  if (first === 0xfe && second === 0xff) {
    return { label: "utf-16be", bomLength: UTF16_BOM_LENGTH };
  }
  return { label: "utf-8", bomLength: 0 };
}

/**
 * Checks the size first, so an oversized file is never read. UTF-8 (the
 * default) and UTF-16 with a byte order mark are decoded; anything else that
 * does not decode cleanly is `encoding-unsupported`.
 */
export async function readImportFile(
  file: File,
): Promise<DecodeResult<"too-large" | "encoding-unsupported">> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return { isOk: false, error: "too-large" };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { label, bomLength } = pickDecoder(bytes);
  const body = bytes.subarray(bomLength);
  if (label !== "utf-8" && body.length % UTF16_BYTES_PER_UNIT !== 0) {
    return { isOk: false, error: "encoding-unsupported" };
  }
  try {
    // The BOM is cut above, so the decoder must not look for one.
    const decoder = new TextDecoder(label, { fatal: true, ignoreBOM: true });
    return { isOk: true, value: decoder.decode(body) };
  } catch {
    return { isOk: false, error: "encoding-unsupported" };
  }
}

export function checkPastedSource(
  text: string,
): DecodeResult<"too-large" | "empty"> {
  // Each UTF-16 code unit is at least one UTF-8 byte, so this text is over the
  // byte limit without encoding the whole string. Checked before `trim()`,
  // which would copy a huge string.
  if (text.length > MAX_IMPORT_FILE_BYTES) {
    return { isOk: false, error: "too-large" };
  }
  if (text.trim() === "") {
    return { isOk: false, error: "empty" };
  }
  if (new TextEncoder().encode(text).length > MAX_IMPORT_FILE_BYTES) {
    return { isOk: false, error: "too-large" };
  }
  return { isOk: true, value: text };
}

export function guessImportFormat(fileName: string): ImportFileFormat | null {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return null;
  return EXTENSION_FORMATS.get(fileName.slice(dot + 1).toLowerCase()) ?? null;
}
