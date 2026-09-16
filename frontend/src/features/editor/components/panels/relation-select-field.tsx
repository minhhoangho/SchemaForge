"use client";

import type { DocumentPath, Issue } from "@schemaforge/core";
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

import { joinIds } from "./relation-issue-fields";
import { RelationIssueMessages } from "./relation-issue-messages";

type RelationSelectFieldProps<Value extends string> = {
  readonly label: string;
  readonly value: Value;
  readonly options: readonly Value[];
  readonly optionLabel: (option: Value) => string;
  readonly onChange: (value: Value) => void;
  readonly issues: readonly Issue[];
  readonly focusPath: DocumentPath;
  readonly hint?: string;
};

/**
 * A labelled select of one relation field. Its issues sit right under it and
 * describe it; `aria-invalid` is allowed here because the trigger has the
 * combobox role. `data-focus-path` lets the editor focus the field an issue
 * points at.
 */
export function RelationSelectField<Value extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
  issues,
  focusPath,
  hint,
}: RelationSelectFieldProps<Value>): JSX.Element {
  const triggerId = useId();
  const hintId = `${triggerId}-hint`;
  const issuesId = `${triggerId}-issues`;
  const hasIssues = issues.length > 0;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={triggerId}>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          const option = options.find((candidate) => candidate === next);
          if (option !== undefined) {
            onChange(option);
          }
        }}
      >
        <SelectTrigger
          id={triggerId}
          className="w-full"
          data-focus-path={JSON.stringify(focusPath)}
          aria-invalid={hasIssues ? true : undefined}
          aria-describedby={joinIds([
            hint === undefined ? undefined : hintId,
            hasIssues ? issuesId : undefined,
          ])}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {optionLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint !== undefined && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {hasIssues && <RelationIssueMessages id={issuesId} issues={issues} />}
    </div>
  );
}
