"use client";

import type { JSX } from "react";
import { useId } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { DialogOption } from "./relation-dialog-fields";

export type DialogSelectFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly options: readonly DialogOption[];
  readonly onChange: (value: string) => void;
  readonly describedBy?: string | undefined;
  readonly isInvalid?: boolean;
  readonly placeholder?: string;
};

/**
 * A labelled select. The trigger has the combobox role, so aria-invalid is
 * allowed on it; `describedBy` names the hint and messages that describe it.
 */
export function DialogSelectField({
  label,
  value,
  options,
  onChange,
  describedBy,
  isInvalid = false,
  placeholder,
}: DialogSelectFieldProps): JSX.Element {
  const triggerId = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={triggerId}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={triggerId}
          className="w-full"
          aria-invalid={isInvalid ? true : undefined}
          aria-describedby={describedBy}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
