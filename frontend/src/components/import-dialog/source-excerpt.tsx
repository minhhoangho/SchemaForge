import type { SourceLocation } from "@schemaforge/core";
import type { JSX } from "react";

import { toSourceExcerpt } from "./to-source-excerpt";

export type SourceExcerptProps = {
  readonly source: string;
  readonly location: SourceLocation;
};

/**
 * The source line of a diagnostic with its error column marked. Everything
 * is a React text node: the source is untrusted.
 */
export function SourceExcerpt({
  source,
  location,
}: SourceExcerptProps): JSX.Element {
  const { line, markColumn } = toSourceExcerpt(source, location);
  const index = markColumn - 1;
  // Past the end of the line the marked cell is an extra space.
  const marked = line.charAt(index) || " ";
  return (
    // The error column is marked in place (not by a caret line below), so
    // wrapping long lines cannot misplace it.
    <pre className="rounded-md bg-muted px-2 py-1 font-mono text-xs break-all whitespace-pre-wrap text-foreground">
      {line.slice(0, index)}
      <mark className="rounded-sm bg-destructive/20 text-foreground underline decoration-destructive decoration-2 underline-offset-2">
        {marked}
      </mark>
      {line.slice(index + 1)}
    </pre>
  );
}
