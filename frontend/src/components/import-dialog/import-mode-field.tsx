"use client";

import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { pickChoice } from "./pick-choice";
import type { ImportModeChoice } from "./use-import-dialog";

const MODES = ["new", "merge"] as const satisfies readonly ImportModeChoice[];

export type ImportModeFieldProps = {
  readonly value: ImportModeChoice;
  readonly onChange: (mode: ImportModeChoice) => void;
};

export function ImportModeField({
  value,
  onChange,
}: ImportModeFieldProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const labelId = useId();
  return (
    <div className="grid gap-2">
      <Label id={labelId}>{t("import.source.modeLabel")}</Label>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={(next) => {
          const mode = pickChoice(MODES, next);
          if (mode !== undefined) onChange(mode);
        }}
      >
        {MODES.map((mode) => (
          <div key={mode} className="flex min-h-6 items-center gap-2">
            <RadioGroupItem value={mode} id={`${labelId}-${mode}`} />
            <Label htmlFor={`${labelId}-${mode}`}>
              {t(
                mode === "new"
                  ? "import.source.modeNew"
                  : "import.source.modeMerge",
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
