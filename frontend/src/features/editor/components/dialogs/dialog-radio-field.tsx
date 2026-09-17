"use client";

import type { JSX } from "react";
import { useId } from "react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { DialogOption } from "./relation-dialog-fields";

type DialogRadioFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly options: readonly DialogOption[];
  readonly onChange: (value: string) => void;
};

/** A radio group named by its visible label, one labelled item per option. */
export function DialogRadioField({
  label,
  value,
  options,
  onChange,
}: DialogRadioFieldProps): JSX.Element {
  const labelId = useId();

  return (
    <div className="grid gap-2">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={onChange}
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <RadioGroupItem
              id={`${labelId}-${option.value}`}
              value={option.value}
            />
            <Label htmlFor={`${labelId}-${option.value}`}>{option.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
