import type { SqlDialect } from "./generator-types.js";

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_ASCII_WORD_CHARACTERS = /[^A-Za-z0-9]+/;
const UPPERCASE_WORD = /^[A-Z0-9]*[A-Z][A-Z0-9]*$/;
const BARE_PROPERTY_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const STARTS_WITH_DIGIT = /^[0-9]/;
const LINE_BREAK = /\r\n|\r|\n/;
const PROTOTYPE_KEY = "__proto__";

// NFD splits most accented letters into a base letter and combining marks.
// Letters with a stroke (such as đ) have no decomposition and are kept.
export function removeCombiningMarks(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "");
}

export function quoteSqlIdentifier(dialect: SqlDialect, name: string): string {
  switch (dialect) {
    case "postgresql":
      return `"${name.replaceAll('"', '""')}"`;
    case "mysql":
      return `\`${name.replaceAll("`", "``")}\``;
    case "sqlserver":
      return `[${name.replaceAll("]", "]]")}]`;
    default: {
      const unreachable: never = dialect;
      return unreachable;
    }
  }
}

export function toAsciiWords(name: string): readonly string[] {
  return removeCombiningMarks(name)
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .split(NON_ASCII_WORD_CHARACTERS)
    .filter((word) => word !== "")
    .map((word) => (UPPERCASE_WORD.test(word) ? word.toLowerCase() : word));
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function withFallback(identifier: string, fallback: string): string {
  if (identifier === "") {
    return fallback;
  }
  return STARTS_WITH_DIGIT.test(identifier)
    ? fallback + identifier
    : identifier;
}

export function toPascalCaseIdentifier(name: string, fallback: string): string {
  return withFallback(toAsciiWords(name).map(capitalize).join(""), fallback);
}

export function toCamelCaseIdentifier(name: string, fallback: string): string {
  const identifier = toAsciiWords(name)
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : capitalize(word),
    )
    .join("");
  return withFallback(identifier, fallback);
}

export function toKebabCaseSegment(name: string, fallback: string): string {
  const segment = toAsciiWords(name)
    .map((word) => word.toLowerCase())
    .join("-");
  return segment === "" ? fallback : segment;
}

export function withReservedWordSuffix(
  identifier: string,
  reservedWords: readonly string[],
): string {
  return reservedWords.includes(identifier) ? `${identifier}_` : identifier;
}

// Both `__proto__: x` and `"__proto__": x` set the prototype of an object
// literal; only a computed key creates an own property (spec section 5).
export function formatPropertyKey(name: string): string {
  if (name === PROTOTYPE_KEY) {
    return `[${JSON.stringify(name)}]`;
  }
  return BARE_PROPERTY_KEY.test(name) ? name : JSON.stringify(name);
}

export function formatJsDocLines(
  text: string,
  indent: string,
): readonly string[] {
  if (text === "") {
    return [];
  }
  const lines = text.replaceAll("*/", "*\\/").split(LINE_BREAK);
  if (lines.length === 1) {
    return [`${indent}/** ${lines.join("")} */`];
  }
  return [
    `${indent}/**`,
    ...lines.map((line) =>
      line === "" ? `${indent} *` : `${indent} * ${line}`,
    ),
    `${indent} */`,
  ];
}
