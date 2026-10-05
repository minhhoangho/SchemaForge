import { zipSync } from "fflate";
import type { Zippable } from "fflate";

export type ZipEntry = {
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly isCompressed: boolean;
};

// Spec section 11: name order and a fixed mtime make the bytes depend on the
// input alone. The ZIP format reads the date as local time, so a local-time
// Date gives 1980-01-01 on every machine.
export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const zippable: Zippable = {};
  const sorted = [...entries].sort((a, b) =>
    a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0,
  );
  for (const entry of sorted) {
    zippable[entry.fileName] = [
      entry.bytes,
      { level: entry.isCompressed ? 6 : 0, mtime: new Date(1980, 0, 1) },
    ];
  }
  return zipSync(zippable);
}
