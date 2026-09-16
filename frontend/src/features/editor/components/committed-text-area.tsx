"use client";

import type { JSX, RefObject } from "react";
import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/class-names";

export type CommittedTextAreaProps = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly errorMessage?: string;
  readonly isLabelHidden?: boolean;
  readonly inputRef?: RefObject<HTMLTextAreaElement | null>;
};

/**
 * The multi-line counterpart of `CommittedTextField`: it commits only on
 * blur, because Enter inserts a line break (spec section 6).
 */
export function CommittedTextArea({
  id,
  label,
  value,
  onCommit,
  errorMessage,
  isLabelHidden = false,
  inputRef,
}: CommittedTextAreaProps): JSX.Element {
  const [draft, setDraft] = useState(value);
  const errorId = `${id}-error`;
  const hasError = errorMessage !== undefined;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(): void {
    if (draft !== value) {
      onCommit(draft);
    }
    setDraft(value);
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className={cn(isLabelHidden && "sr-only")}>
        {label}
      </Label>
      <Textarea
        id={id}
        ref={inputRef}
        value={draft}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={hasError ? errorId : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft(value);
          }
        }}
      />
      {hasError && (
        <p id={errorId} className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
