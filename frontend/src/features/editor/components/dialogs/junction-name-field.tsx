"use client";

import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { RelationFieldsProps } from "./relation-dialog-fields";

/** The name of the junction table a many-to-many relation creates. */
export function JunctionNameField({
  draft,
  onChange,
}: RelationFieldsProps): JSX.Element {
  const { t } = useTranslation("editor");
  const fieldId = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={fieldId}>{t("relationDialog.junctionTableName")}</Label>
      <Input
        id={fieldId}
        value={draft.junctionTableName}
        autoComplete="off"
        onChange={(event) => {
          onChange({ ...draft, junctionTableName: event.target.value });
        }}
      />
    </div>
  );
}
