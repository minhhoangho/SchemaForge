"use client";

import type { SqlDialect } from "@schemaforge/core";
import { TriangleAlertIcon } from "lucide-react";
import type { JSX, ReactNode, RefObject } from "react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBlob } from "@/lib/download/download-blob";
import {
  DOWNLOAD_MIME_TYPES,
  toZipFileName,
} from "@/lib/import-export/download-file-names";
import { useNotify } from "@/lib/use-notify";

import { useBuildZip } from "../code-generator/use-build-zip";
import { getIssueIndex } from "../lib/issue-index";
import { useEditorStore } from "../state/use-editor-store";
import {
  clearZip,
  countZipFiles,
  selectAllZip,
  type ZipSelection,
} from "./zip-selection";

export type ZipDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  // The menu item that opened the dialog is gone by the time it closes, so
  // focus goes back to the menu's trigger instead.
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  // Tests only: the worker is the boundary they replace.
  readonly createWorker?: () => Worker;
};

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

function IssueWarning(): JSX.Element | null {
  const { t } = useTranslation("importExport");
  const document = useEditorStore((state) => state.document);
  const { issues } = getIssueIndex(document);
  if (issues.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-2 text-sm">
      <TriangleAlertIcon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      <p>{t("zip.issueWarning", { count: issues.length })}</p>
    </div>
  );
}

function SelectionFields({
  selection,
  onChange,
}: {
  readonly selection: ZipSelection;
  readonly onChange: (selection: ZipSelection) => void;
}): JSX.Element {
  const { t } = useTranslation("importExport");
  const codeOptions = useEditorStore((state) => state.codeOptions);
  const dialectLabel = (dialect: SqlDialect): string =>
    t(`dialects.${dialect}`);
  const toggle = (key: ToggleKey): JSX.Element => (
    <Item
      label={t(`zip.items.${key}`)}
      isChecked={selection[key]}
      onChange={(isChecked) => {
        onChange({ ...selection, [key]: isChecked });
      }}
    />
  );

  return (
    <div className="grid gap-4">
      <Group legend={t("zip.groups.schema")}>{toggle("json")}</Group>
      <Group legend={t("zip.groups.images")}>
        {toggle("png")}
        {toggle("svg")}
      </Group>
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
      <Group legend={t("zip.groups.code")}>
        {toggle("typescript")}
        {toggle("zod")}
        {toggle("mockApi")}
        {toggle("openapi")}
      </Group>
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
      <Group legend={t("zip.groups.docs")}>
        {toggle("dbml")}
        {toggle("markdown")}
      </Group>
    </div>
  );
}

export function ZipDialog({
  open,
  onOpenChange,
  returnFocusRef,
  createWorker,
}: ZipDialogProps): JSX.Element {
  const { t } = useTranslation(["importExport", "common"]);
  const notify = useNotify();
  const selection = useEditorStore((state) => state.zipSelection);
  const codeOptions = useEditorStore((state) => state.codeOptions);
  const setZipSelection = useEditorStore((state) => state.setZipSelection);
  const { isBuilding, build } = useBuildZip({ createWorker });
  const [diagnosticCount, setDiagnosticCount] = useState<number | null>(null);
  const fileCount = countZipFiles(selection);

  const download = (): void => {
    build().then(
      ({ bytes, diagnosticCount: count, baseName }) => {
        setDiagnosticCount(count);
        downloadBlob(
          new Blob([bytes.slice()], { type: DOWNLOAD_MIME_TYPES.zip }),
          toZipFileName(baseName),
        );
      },
      () => {
        // The toast is the whole report: the error holds nothing worth logging.
        notify({ tone: "error", titleKey: "importExport:export.failed" });
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("common:actions.close")}
        onCloseAutoFocus={(event) => {
          const trigger = returnFocusRef?.current;
          if (trigger !== undefined && trigger !== null) {
            event.preventDefault();
            trigger.focus();
          }
        }}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{t("importExport:zip.title")}</DialogTitle>
          <DialogDescription>
            {t("importExport:zip.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setZipSelection(selectAllZip(codeOptions));
            }}
          >
            {t("importExport:zip.selectAll")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setZipSelection(clearZip());
            }}
          >
            {t("importExport:zip.clearAll")}
          </Button>
        </div>
        <IssueWarning />
        <SelectionFields selection={selection} onChange={setZipSelection} />
        <p role="status" className="text-sm text-muted-foreground">
          {isBuilding
            ? t("importExport:zip.generating")
            : diagnosticCount === null
              ? t("importExport:zip.filesOnly", { count: fileCount })
              : t("importExport:zip.summary", {
                  files: fileCount,
                  diagnostics: diagnosticCount,
                })}
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button disabled={fileCount === 0 || isBuilding} onClick={download}>
            {isBuilding
              ? t("importExport:zip.generating")
              : t("importExport:zip.download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
