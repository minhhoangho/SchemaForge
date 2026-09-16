"use client";

import type { JSX, KeyboardEvent, RefObject } from "react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/class-names";

// Browsers send keyCode 229 for a key event that belongs to an IME
// composition. Safari reports `isComposing` false on the keydown that confirms
// a Vietnamese Telex or VNI composition, so only this code tells that Enter
// apart from a real one.
const IME_PROCESS_KEY_CODE = 229;

function isImeKeyEvent(event: KeyboardEvent<HTMLInputElement>): boolean {
  return (
    event.nativeEvent.isComposing ||
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- keyCode is the only signal Safari gives for the Enter that ends an IME composition
    event.nativeEvent.keyCode === IME_PROCESS_KEY_CODE
  );
}

export type CommittedTextFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly errorMessage?: string;
  readonly inputMode?: "text" | "numeric";
  readonly isLabelHidden?: boolean;
  readonly inputRef?: RefObject<HTMLInputElement | null>;
};

/**
 * A one-line field that reports its value only when the user is done with it:
 * on blur, or on Enter outside an IME composition (spec section 6), so one
 * edit is one dispatch and one undo step. Escape drops the draft. After a
 * commit the field shows `value` again: a caller that applies the commit
 * passes the new value back, one that rejects it leaves the old one showing.
 */
export function CommittedTextField({
  id,
  label,
  value,
  onCommit,
  errorMessage,
  inputMode = "text",
  isLabelHidden = false,
  inputRef,
}: CommittedTextFieldProps): JSX.Element {
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

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter" && !isImeKeyEvent(event)) {
      commit();
      return;
    }
    if (event.key === "Escape") {
      setDraft(value);
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className={cn(isLabelHidden && "sr-only")}>
        {label}
      </Label>
      <Input
        id={id}
        ref={inputRef}
        value={draft}
        inputMode={inputMode}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={hasError ? errorId : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
      {hasError && (
        <p id={errorId} className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
