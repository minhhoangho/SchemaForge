// Every generator assembles its file through this function, so the content
// always ends with exactly one "\n".
export function renderFileContent(
  blocks: readonly (readonly string[])[],
): string {
  const text = blocks
    .filter((block) => block.length > 0)
    .map((block) => block.join("\n"))
    .join("\n\n");
  // A scan instead of /\n+$/, which backtracks quadratically on long newline runs.
  let end = text.length;
  while (end > 0 && text[end - 1] === "\n") {
    end -= 1;
  }
  return `${text.slice(0, end)}\n`;
}
