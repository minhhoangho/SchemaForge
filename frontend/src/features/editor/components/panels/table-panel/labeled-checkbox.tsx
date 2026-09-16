"use client";

import type { DocumentPath } from "@schemaforge/core";
import type { JSX } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type LabeledCheckboxProps = {
  readonly id: string;
  readonly label: string;
  readonly isChecked: boolean;
  readonly onCheckedChange: (isChecked: boolean) => void;
  readonly errorMessage?: string;
  // Rendered as `data-focus-path` so a focus request for this path finds the checkbox.
  readonly focusPath?: DocumentPath;
};

/**
 * A checkbox with a visible label and, when its field has issues, the
 * message right below it, tied to the checkbox by `aria-describedby`
 * (spec section 4 "Trong panel").
 */
export function LabeledCheckbox({
  id,
  label,
  isChecked,
  onCheckedChange,
  errorMessage,
  focusPath,
}: LabeledCheckboxProps): JSX.Element {
  const errorId = `${id}-error`;
  const hasError = errorMessage !== undefined;

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={isChecked}
          data-focus-path={
            focusPath === undefined ? undefined : JSON.stringify(focusPath)
          }
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? errorId : undefined}
          onCheckedChange={(checked) => {
            onCheckedChange(checked === true);
          }}
        />
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
      </div>
      {hasError && (
        <p id={errorId} className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
