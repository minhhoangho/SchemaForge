"use client";

import type { JSX, Ref } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type PasteSourceFieldProps = {
  readonly textRef: Ref<HTMLTextAreaElement>;
  readonly value: string;
  readonly isInvalid: boolean;
  readonly describedBy: string | undefined;
  readonly onChange: (text: string) => void;
};

export function PasteSourceField({
  textRef,
  value,
  isInvalid,
  describedBy,
  onChange,
}: PasteSourceFieldProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const textId = useId();
  return (
    <>
      <Label htmlFor={textId}>{t("import.source.pasteLabel")}</Label>
      <Textarea
        ref={textRef}
        id={textId}
        value={value}
        rows={8}
        spellCheck={false}
        className="font-mono"
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </>
  );
}
