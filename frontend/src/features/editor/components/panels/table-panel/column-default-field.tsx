"use client";

import type { Column, ColumnDefault } from "@schemaforge/core";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { getAllowedColumnDefaults } from "../../../lib/allowed-column-defaults";
import { CommittedTextField } from "../../committed-text-field";

type ColumnDefaultFieldProps = {
  readonly column: Column;
  readonly errorMessage: string | undefined;
  readonly onDefaultChange: (defaultValue: ColumnDefault | null) => void;
};

const NO_DEFAULT = "none";
const COLUMNS_SEGMENT = "columns";
const DEFAULT_VALUE_SEGMENT = "defaultValue";

type DefaultOption = typeof NO_DEFAULT | ColumnDefault["kind"];

const OPTION_LABEL_KEYS = {
  none: "tablePanel.columns.default.none",
  literal: "tablePanel.columns.default.literal",
  currentTimestamp: "tablePanel.columns.default.currentTimestamp",
  generateUuid: "tablePanel.columns.default.generateUuid",
} as const satisfies Record<DefaultOption, string>;

// The stored default stays listed even when the type no longer allows it, so
// the checked radio always matches the document and the issue explains why.
function listOptions(column: Column): readonly DefaultOption[] {
  const allowed = getAllowedColumnDefaults(column.type);
  const storedKind = column.defaultValue?.kind;
  const hasStrayDefault =
    storedKind !== undefined && !allowed.includes(storedKind);
  return [NO_DEFAULT, ...allowed, ...(hasStrayDefault ? [storedKind] : [])];
}

function buildDefault(
  option: DefaultOption,
  previous: ColumnDefault | null,
): ColumnDefault | null {
  switch (option) {
    case "none":
      return null;
    case "literal":
      return previous?.kind === "literal"
        ? previous
        : { kind: "literal", value: "" };
    case "currentTimestamp":
    case "generateUuid":
      return { kind: option };
    default: {
      const unhandledOption: never = option;
      return unhandledOption;
    }
  }
}

/**
 * The default value of a column: a radio per kind the column type allows
 * (spec section 2 "Cột"), plus a value field when the default is a literal.
 */
export function ColumnDefaultField({
  column,
  errorMessage,
  onDefaultChange,
}: ColumnDefaultFieldProps): JSX.Element {
  const { t } = useTranslation("editor");
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const errorId = `${baseId}-error`;
  const hasError = errorMessage !== undefined;
  const options = listOptions(column);
  const { defaultValue } = column;
  const focusPath = [COLUMNS_SEGMENT, column.id, DEFAULT_VALUE_SEGMENT];
  const checkedOption = defaultValue?.kind ?? NO_DEFAULT;
  const isLiteral = defaultValue?.kind === "literal";

  return (
    <div className="grid gap-2">
      <span id={labelId} className="text-sm font-medium">
        {t("tablePanel.columns.default.label")}
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        aria-describedby={hasError ? errorId : undefined}
        aria-invalid={hasError ? true : undefined}
        value={checkedOption}
        onValueChange={(value) => {
          const option = options.find((candidate) => candidate === value);
          if (option !== undefined) {
            onDefaultChange(buildDefault(option, defaultValue));
          }
        }}
      >
        {options.map((option) => (
          <div key={option} className="flex items-center gap-2">
            <RadioGroupItem
              id={`${baseId}-${option}`}
              value={option}
              // The issue of a literal default is about its value, so the
              // value field takes the focus request; for any other default
              // the checked radio does, as the one that Tab reaches.
              data-focus-path={
                !isLiteral && option === checkedOption
                  ? JSON.stringify(focusPath)
                  : undefined
              }
            />
            <Label htmlFor={`${baseId}-${option}`} className="font-normal">
              {t(OPTION_LABEL_KEYS[option])}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {hasError && (
        <p id={errorId} className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
      {defaultValue?.kind === "literal" && (
        <CommittedTextField
          id={`${baseId}-value`}
          label={t("tablePanel.columns.default.valueLabel")}
          value={defaultValue.value}
          focusPath={focusPath}
          onCommit={(value) => {
            onDefaultChange({ kind: "literal", value });
          }}
        />
      )}
    </div>
  );
}
