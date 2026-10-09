"use client";

import type { DragEvent, JSX, Ref } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guessImportFormat } from "@/lib/import-export/decode-import-file";

import type { SourceForm } from "./use-import-dialog";

const ACCEPTED_EXTENSIONS = ".sql,.prisma,.dbml,.json";

export type FileSourceFieldProps = {
  readonly form: SourceForm;
  readonly inputRef: Ref<HTMLInputElement>;
  readonly isInvalid: boolean;
  readonly describedBy: string | undefined;
  readonly onChange: (patch: Partial<SourceForm>) => void;
};

export function FileSourceField({
  form,
  inputRef,
  isInvalid,
  describedBy,
  onChange,
}: FileSourceFieldProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const inputId = useId();
  const selectFile = (file: File | undefined): void => {
    if (file === undefined) return;
    onChange({ file, format: guessImportFormat(file.name) ?? form.format });
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    selectFile(event.dataTransfer.files[0]);
  };

  return (
    <>
      <Label htmlFor={inputId}>{t("import.source.chooseFile")}</Label>
      <Input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
        }}
      />
      {/* The drop target is the pointer shortcut; the input above does the
          same by keyboard or by click (WCAG 2.5.7). */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={handleDrop}
        role="status"
        className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground"
      >
        {form.file === null
          ? t("import.source.dropZone")
          : t("import.source.selectedFile", { name: form.file.name })}
      </div>
    </>
  );
}
