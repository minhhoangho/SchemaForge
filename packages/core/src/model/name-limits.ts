// PostgreSQL silently truncates identifiers and enum labels longer than 63 bytes.
export const MAX_NAME_BYTES = 63;

const MAX_ONE_BYTE_CODE_UNIT = 0x7f;
const MAX_TWO_BYTE_CODE_UNIT = 0x7ff;
const SURROGATE_PAIR_LENGTH = 2;
const SURROGATE_PAIR_BYTES = 4;
const MAX_BASIC_PLANE_BYTES = 3;

// A string iterator yields one code point per step: a surrogate pair for a
// supplementary character, one code unit otherwise. A lone surrogate counts as
// three bytes, matching the U+FFFD that TextEncoder substitutes for it.
function characterByteLength(character: string): number {
  if (character.length === SURROGATE_PAIR_LENGTH) {
    return SURROGATE_PAIR_BYTES;
  }
  const codeUnit = character.charCodeAt(0);
  if (codeUnit <= MAX_ONE_BYTE_CODE_UNIT) {
    return 1;
  }
  return codeUnit <= MAX_TWO_BYTE_CODE_UNIT ? 2 : MAX_BASIC_PLANE_BYTES;
}

// TextEncoder is not in core's lib, so the UTF-8 length is computed by hand.
export function utf8ByteLength(text: string): number {
  let byteLength = 0;
  for (const character of text) {
    byteLength += characterByteLength(character);
  }
  return byteLength;
}

// toLowerCase, unlike toLocaleLowerCase, gives the same key in every locale.
export function toNameKey(name: string): string {
  return name.toLowerCase();
}
