"use client";

import type { SqlDialect } from "@schemaforge/core";
import type { JSX, Ref } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ImportFileFormat } from "@/lib/import-export/decode-import-file";

import { pickChoice } from "./pick-choice";

const FORMATS = [
  "sql",
  "prisma",
  "dbml",
  "json",
] as const satisfies readonly ImportFileFormat[];
const SQL_DIALECTS = [
  "postgresql",
  "mysql",
  "sqlserver",
] as const satisfies readonly SqlDialect[];

export type FormatFieldsProps = {
  readonly format: ImportFileFormat;
  readonly dialect: SqlDialect | null;
  readonly dialectTriggerRef: Ref<HTMLButtonElement>;
  readonly isDialectInvalid: boolean;
  readonly describedBy: string | undefined;
  readonly onFormatChange: (format: ImportFileFormat) => void;
  readonly onDialectChange: (dialect: SqlDialect) => void;
};

export function FormatFields({
  format,
  dialect,
  dialectTriggerRef,
  isDialectInvalid,
  describedBy,
  onFormatChange,
  onDialectChange,
}: FormatFieldsProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const formatId = useId();
  const dialectId = useId();
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={formatId}>{t("import.source.formatLabel")}</Label>
        <Select
          value={format}
          onValueChange={(value) => {
            const next = pickChoice(FORMATS, value);
            if (next !== undefined) onFormatChange(next);
          }}
        >
          <SelectTrigger id={formatId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`formats.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {format === "sql" && (
        <div className="grid gap-1.5">
          <Label htmlFor={dialectId}>{t("import.source.dialectLabel")}</Label>
          <Select
            value={dialect ?? ""}
            onValueChange={(value) => {
              const next = pickChoice(SQL_DIALECTS, value);
              if (next !== undefined) onDialectChange(next);
            }}
          >
            <SelectTrigger
              ref={dialectTriggerRef}
              id={dialectId}
              aria-invalid={isDialectInvalid || undefined}
              aria-describedby={isDialectInvalid ? describedBy : undefined}
            >
              <SelectValue
                placeholder={t("import.source.dialectPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {SQL_DIALECTS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`dialects.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
