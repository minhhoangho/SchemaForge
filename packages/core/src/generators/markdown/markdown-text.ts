// Markdown-only escaping: `generators/shared/` has no equivalent, and every
// user name, comment, value and label in the Markdown output goes through
// `formatMarkdownInline`.

const MARKDOWN_SPECIAL_CHARACTER_PATTERN = /[\\`*_{}[\]()#+\-.!|<>~]/g;
const LINE_BREAK_PATTERN = /\r\n|\r|\n/g;
const LINE_BREAK_TAG = "<br>";

/** Adds `\` before every Markdown special character (`|` included, for table cells). */
export function escapeMarkdownText(text: string): string {
  return text.replace(MARKDOWN_SPECIAL_CHARACTER_PATTERN, "\\$&");
}

/**
 * Escaped text on one line: line breaks become `<br>`, so a value can sit in a
 * heading, a list item or a table cell without ending it. The tag is added
 * after escaping, so its `<` and `>` stay unescaped.
 */
export function formatMarkdownInline(text: string): string {
  return escapeMarkdownText(text).replace(LINE_BREAK_PATTERN, LINE_BREAK_TAG);
}
