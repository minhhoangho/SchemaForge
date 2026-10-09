"use client";

import type { JSX, Ref } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SchemaNameFieldProps = {
  readonly inputRef: Ref<HTMLInputElement>;
  readonly value: string;
  readonly isMissing: boolean;
  readonly onChange: (value: string) => void;
};

export function SchemaNameField({
  inputRef,
  value,
  isMissing,
  onChange,
}: SchemaNameFieldProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const inputId = useId();
  const errorId = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{t("import.preview.schemaNameLabel")}</Label>
      <Input
        ref={inputRef}
        id={inputId}
        value={value}
        aria-invalid={isMissing || undefined}
        aria-describedby={isMissing ? errorId : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {isMissing && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {t("import.preview.schemaNameRequired")}
        </p>
      )}
    </div>
  );
}
