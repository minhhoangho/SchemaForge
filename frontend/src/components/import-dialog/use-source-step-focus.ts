import { useEffect, useRef, type RefObject } from "react";

import type { SourceErrorKey } from "./use-import-dialog";

export type UseSourceStepFocusOptions = {
  // True when the user comes back to this step.
  readonly shouldMoveFocus: boolean;
  readonly error: SourceErrorKey | null;
  readonly refs: {
    readonly fileRef: RefObject<HTMLInputElement | null>;
    readonly textRef: RefObject<HTMLTextAreaElement | null>;
    readonly analyzeRef: RefObject<HTMLButtonElement | null>;
    readonly dialectRef: RefObject<HTMLButtonElement | null>;
  };
};

/**
 * On arrival focus goes to the problem (or to "Analyze"), since the control
 * that had focus is gone; later edits never steal it. A missing dialect is
 * reported while focus is on "Analyze", so it moves to the dialect field.
 */
export function useSourceStepFocus({
  shouldMoveFocus,
  error,
  refs,
}: UseSourceStepFocusOptions): void {
  const { fileRef, textRef, analyzeRef, dialectRef } = refs;
  const hasArrivedRef = useRef(false);
  useEffect(() => {
    if (hasArrivedRef.current) return;
    hasArrivedRef.current = true;
    if (!shouldMoveFocus) return;
    const field = fileRef.current ?? textRef.current;
    (error === null ? analyzeRef.current : field)?.focus();
  }, [shouldMoveFocus, error, fileRef, textRef, analyzeRef]);
  const isDialectInvalid = error === "dialectRequired";
  useEffect(() => {
    if (isDialectInvalid) dialectRef.current?.focus();
  }, [isDialectInvalid, dialectRef]);
}
