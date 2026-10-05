"use client";

import type { SqlDialect } from "@schemaforge/core";
import type { JSX, ReactNode } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useEditorStore } from "../state/use-editor-store";
import type { ZipSelection } from "./zip-selection";

const SQL_DIALECTS = [
  "postgresql",
  "mysql",
  "sqlserver",
] as const satisfies readonly SqlDialect[];
const DRIZZLE_DIALECTS = ["postgresql", "mysql"] as const;
const SEED_FORMATS = [...SQL_DIALECTS, "json"] as const;

type ToggleKey =
  | "json"
  | "png"
  | "svg"
  | "typescript"
  | "zod"
  | "mockApi"
  | "openapi"
  | "dbml"
  | "markdown";

type ItemProps = {
  readonly label: string;
  readonly isChecked: boolean;
  readonly onChange: (isChecked: boolean) => void;
  readonly children?: ReactNode;
};

function Item({
  label,
  isChecked,
  onChange,
  children,
}: ItemProps): JSX.Element {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex min-h-6 items-center gap-2">
        <Checkbox
          id={id}
          checked={isChecked}
          onCheckedChange={(next) => {
            onChange(next === true);
          }}
        />
        <Label htmlFor={id}>{label}</Label>
      </div>
      {isChecked && children}
    </div>
  );
}

type ChoiceProps<Value extends string> = {
  readonly label: string;
  readonly value: Value;
  readonly choices: readonly Value[];
  readonly labelOf: (choice: Value) => string;
  readonly onChange: (value: Value) => void;
};

function Choice<Value extends string>({
  label,
  value,
  choices,
  labelOf,
  onChange,
}: ChoiceProps<Value>): JSX.Element {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const choice = choices.find((candidate) => candidate === next);
        if (choice !== undefined) onChange(choice);
      }}
    >
      <SelectTrigger aria-label={label} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice} value={choice}>
            {labelOf(choice)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Group({
  legend,
  children,
}: {
  readonly legend: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

type GroupProps = {
  readonly selection: ZipSelection;
  readonly onChange: (selection: ZipSelection) => void;
};

function useDialectLabel(): (dialect: SqlDialect) => string {
  const { t } = useTranslation("importExport");
  return (dialect) => t(`dialects.${dialect}`);
}

function ToggleGroup({
  legend,
  keys,
  selection,
  onChange,
}: GroupProps & {
  readonly legend: string;
  readonly keys: readonly ToggleKey[];
}): JSX.Element {
  const { t } = useTranslation("importExport");
  return (
    <Group legend={legend}>
      {keys.map((toggleKey) => (
        <Item
          key={toggleKey}
          label={t(`zip.items.${toggleKey}`)}
          isChecked={selection[toggleKey]}
          onChange={(isChecked) => {
            onChange({ ...selection, [toggleKey]: isChecked });
          }}
        />
      ))}
    </Group>
  );
}

function SqlGroup({ selection, onChange }: GroupProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const dialectLabel = useDialectLabel();
  return (
    <Group legend={t("zip.groups.sql")}>
      {SQL_DIALECTS.map((dialect) => (
        <Item
          key={dialect}
          label={dialectLabel(dialect)}
          isChecked={selection.sql.includes(dialect)}
          onChange={(isChecked) => {
            onChange({
              ...selection,
              sql: SQL_DIALECTS.filter((candidate) =>
                candidate === dialect
                  ? isChecked
                  : selection.sql.includes(candidate),
              ),
            });
          }}
        />
      ))}
    </Group>
  );
}

function OrmGroup({ selection, onChange }: GroupProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const codeOptions = useEditorStore((state) => state.codeOptions);
  const dialectLabel = useDialectLabel();
  return (
    <Group legend={t("zip.groups.orm")}>
      <Item
        label={t("zip.items.prisma")}
        isChecked={selection.prisma !== null}
        onChange={(isChecked) => {
          onChange({
            ...selection,
            prisma: isChecked ? codeOptions.prismaProvider : null,
          });
        }}
      >
        {selection.prisma !== null && (
          <Choice
            label={t("zip.prismaProvider")}
            value={selection.prisma}
            choices={SQL_DIALECTS}
            labelOf={dialectLabel}
            onChange={(prisma) => {
              onChange({ ...selection, prisma });
            }}
          />
        )}
      </Item>
      <Item
        label={t("zip.items.drizzle")}
        isChecked={selection.drizzle !== null}
        onChange={(isChecked) => {
          onChange({
            ...selection,
            drizzle: isChecked ? codeOptions.drizzleDialect : null,
          });
        }}
      >
        {selection.drizzle !== null && (
          <Choice
            label={t("zip.drizzleDialect")}
            value={selection.drizzle}
            choices={DRIZZLE_DIALECTS}
            labelOf={dialectLabel}
            onChange={(drizzle) => {
              onChange({ ...selection, drizzle });
            }}
          />
        )}
      </Item>
    </Group>
  );
}

function DataGroup({ selection, onChange }: GroupProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const codeOptions = useEditorStore((state) => state.codeOptions);
  const dialectLabel = useDialectLabel();
  return (
    <Group legend={t("zip.groups.data")}>
      <Item
        label={t("zip.items.seed")}
        isChecked={selection.seed !== null}
        onChange={(isChecked) => {
          onChange({
            ...selection,
            seed: isChecked ? codeOptions.seedFormat : null,
          });
        }}
      >
        {selection.seed !== null && (
          <Choice
            label={t("zip.seedFormat")}
            value={selection.seed}
            choices={SEED_FORMATS}
            labelOf={(format) =>
              format === "json" ? t("formats.json") : dialectLabel(format)
            }
            onChange={(seed) => {
              onChange({ ...selection, seed });
            }}
          />
        )}
      </Item>
    </Group>
  );
}

export function ZipSelectionFields({
  selection,
  onChange,
}: GroupProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const shared = { selection, onChange };
  return (
    <div className="grid gap-4">
      <ToggleGroup
        {...shared}
        legend={t("zip.groups.schema")}
        keys={["json"]}
      />
      <ToggleGroup
        {...shared}
        legend={t("zip.groups.images")}
        keys={["png", "svg"]}
      />
      <SqlGroup {...shared} />
      <OrmGroup {...shared} />
      <ToggleGroup
        {...shared}
        legend={t("zip.groups.code")}
        keys={["typescript", "zod", "mockApi", "openapi"]}
      />
      <DataGroup {...shared} />
      <ToggleGroup
        {...shared}
        legend={t("zip.groups.docs")}
        keys={["dbml", "markdown"]}
      />
    </div>
  );
}
