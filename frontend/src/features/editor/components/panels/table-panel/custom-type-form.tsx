"use client";

import type { JSX } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CustomTypeFormProps = {
  readonly initialName: string;
  readonly onApply: (name: string) => void;
};

/**
 * The "Custom type…" step of the type combobox: a name field that replaces
 * the list inside the same popover. It takes focus when it appears, because
 * the list's search box that had focus is gone.
 */
export function CustomTypeForm({
  initialName,
  onApply,
}: CustomTypeFormProps): JSX.Element {
  const { t } = useTranslation("editor");
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const isEmpty = name.trim() === "";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="grid gap-2 p-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isEmpty) {
          onApply(name);
        }
      }}
    >
      <Label htmlFor={fieldId}>{t("tablePanel.columns.customTypeLabel")}</Label>
      <Input
        id={fieldId}
        ref={inputRef}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <Button type="submit" size="sm" disabled={isEmpty}>
        {t("tablePanel.columns.applyCustomType")}
      </Button>
    </form>
  );
}
