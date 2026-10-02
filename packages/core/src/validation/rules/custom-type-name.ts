import { MAX_NAME_BYTES, utf8ByteLength } from "../../model/name-limits.js";

// SQL generators print a custom type verbatim inside CREATE TABLE, so the name
// may only be a type: words separated by single spaces, at most one argument
// list of identifiers or unsigned integers, then array suffixes. Every part is
// delimited by a fixed character, so the pattern matches in linear time.
const WORD = "[A-Za-z_][A-Za-z0-9_]*";
const ARGUMENT = `(?:${WORD}|[0-9]+)`;
const ARGUMENT_LIST = `\\(${ARGUMENT}(?: ?, ?${ARGUMENT})*\\)`;
const CUSTOM_TYPE_NAME_PATTERN = new RegExp(
  `^${WORD}(?: ${WORD})*(?: ?${ARGUMENT_LIST})?(?:\\[\\])*$`,
);
const WORD_SEPARATOR = /[^A-Za-z0-9_]+/;

// The pattern alone still lets words start a column clause ("int NOT NULL",
// "int REFERENCES t(id)"); no type name needs these keywords.
const CLAUSE_KEYWORDS: ReadonlySet<string> = new Set([
  "CHECK",
  "REFERENCES",
  "DEFAULT",
  "CONSTRAINT",
  "PRIMARY",
  "FOREIGN",
  "UNIQUE",
  "KEY",
  "NOT",
  "NULL",
  "COLLATE",
  "GENERATED",
  "AS",
  "ON",
  "AUTO_INCREMENT",
  "IDENTITY",
  "COMMENT",
]);

function hasClauseKeyword(name: string): boolean {
  return name
    .split(WORD_SEPARATOR)
    .some((word) => CLAUSE_KEYWORDS.has(word.toUpperCase()));
}

/** The condition of `column-custom-type-invalid`, shared with the SQL generators. */
export function isSafeCustomTypeName(name: string): boolean {
  return (
    utf8ByteLength(name) <= MAX_NAME_BYTES &&
    CUSTOM_TYPE_NAME_PATTERN.test(name) &&
    !hasClauseKeyword(name)
  );
}
