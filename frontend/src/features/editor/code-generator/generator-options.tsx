"use client";

import type { SqlDialect } from "@schemaforge/core";
import type { JSX } from "react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  clampSeed,
  clampSeedRowsPerTable,
  MAX_ROWS_PER_TABLE,
  MAX_SEED,
  MIN_ROWS_PER_TABLE,
  MIN_SEED,
} from "./generator-request";
import type { CodeOptions, CodeTarget } from "./generator-request";

const SQL_DIALECTS = [
  "postgresql",
  "mysql",
  "sqlserver",
] as const satisfies readonly SqlDialect[];
const SEED_FORMATS = [...SQL_DIALECTS, "json"] as const;
// Drizzle lists SQL Server so users see why it is missing, but cannot pick it.
const DRIZZLE_DIALECTS = SQL_DIALECTS;

type DialectKey = (typeof SEED_FORMATS)[number];

type OptionSelectProps<Value extends DialectKey> = {
  readonly label: string;
  readonly value: Value;
  readonly choices: readonly Value[];
  readonly isChoiceDisabled?: (choice: Value) => boolean;
  readonly describedBy?: string;
  readonly onChange: (value: Value) => void;
};

function OptionSelect<Value extends DialectKey>({
  label,
  value,
  choices,
  isChoiceDisabled,
  describedBy,
  onChange,
}: OptionSelectProps<Value>): JSX.Element {
  const { t } = useTranslation("codeGenerator");
  const triggerId = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={triggerId}>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          const choice = choices.find((candidate) => candidate === next);
          if (choice !== undefined) {
            onChange(choice);
          }
        }}
      >
        <SelectTrigger
          id={triggerId}
          className="w-full"
          aria-describedby={describedBy}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem
              key={choice}
              value={choice}
              disabled={isChoiceDisabled?.(choice) === true}
            >
              {t(`dialects.${choice}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type NumberFieldProps = {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly clamp: (value: number) => number;
  readonly onCommit: (value: number) => void;
};

// The text is kept while typing and clamped on blur, so an empty or partial
// entry never reaches the generator (core throws outside the range).
function NumberField({
  label,
  value,
  min,
  max,
  clamp,
  onCommit,
}: NumberFieldProps): JSX.Element {
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          // An empty entry keeps the previous value instead of becoming 0.
          if (draft !== null && draft.trim() !== "") {
            onCommit(clamp(Number(draft)));
          }
          if (draft !== null) {
            setDraft(null);
          }
        }}
      />
    </div>
  );
}

export type GeneratorOptionsProps = {
  readonly target: CodeTarget;
  readonly options: CodeOptions;
  readonly onChange: (patch: Partial<CodeOptions>) => void;
};

/** The options of the chosen output; Markdown and the code targets have none. */
export function GeneratorOptions({
  target,
  options,
  onChange,
}: GeneratorOptionsProps): JSX.Element | null {
  const { t } = useTranslation("codeGenerator");
  const noteId = useId();

  switch (target) {
    case "sql":
      return (
        <OptionSelect
          label={t("options.sqlDialect")}
          value={options.sqlDialect}
          choices={SQL_DIALECTS}
          onChange={(sqlDialect) => {
            onChange({ sqlDialect });
          }}
        />
      );
    case "prisma":
      return (
        <OptionSelect
          label={t("options.prismaProvider")}
          value={options.prismaProvider}
          choices={SQL_DIALECTS}
          onChange={(prismaProvider) => {
            onChange({ prismaProvider });
          }}
        />
      );
    case "drizzle":
      return (
        <div className="grid gap-1.5">
          <OptionSelect
            label={t("options.drizzleDialect")}
            value={options.drizzleDialect}
            choices={DRIZZLE_DIALECTS}
            isChoiceDisabled={(choice) => choice === "sqlserver"}
            describedBy={noteId}
            onChange={(drizzleDialect) => {
              if (drizzleDialect !== "sqlserver") {
                onChange({ drizzleDialect });
              }
            }}
          />
          <p id={noteId} className="text-xs text-muted-foreground">
            {t("drizzleSqlServerNote")}
          </p>
        </div>
      );
    case "seed":
      return (
        <div className="grid gap-3">
          <OptionSelect
            label={t("options.seedFormat")}
            value={options.seedFormat}
            choices={SEED_FORMATS}
            onChange={(seedFormat) => {
              onChange({ seedFormat });
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label={t("options.seedRowsPerTable")}
              value={options.seedRowsPerTable}
              min={MIN_ROWS_PER_TABLE}
              max={MAX_ROWS_PER_TABLE}
              clamp={clampSeedRowsPerTable}
              onCommit={(seedRowsPerTable) => {
                onChange({ seedRowsPerTable });
              }}
            />
            <NumberField
              label={t("options.seedSeed")}
              value={options.seedSeed}
              min={MIN_SEED}
              max={MAX_SEED}
              clamp={clampSeed}
              onCommit={(seedSeed) => {
                onChange({ seedSeed });
              }}
            />
          </div>
        </div>
      );
    case "typescript":
    case "zod":
    case "mock-api":
    case "openapi":
    case "dbml":
    case "markdown":
      return null;
    default: {
      const unreachable: never = target;
      return unreachable;
    }
  }
}
