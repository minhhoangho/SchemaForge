"use client";

import type { JSX } from "react";
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

import { CODE_TARGETS } from "./generator-request";
import type { CodeTarget } from "./generator-request";

export type GeneratorTargetSelectProps = {
  readonly value: CodeTarget;
  readonly onChange: (target: CodeTarget) => void;
};

export function GeneratorTargetSelect({
  value,
  onChange,
}: GeneratorTargetSelectProps): JSX.Element {
  const { t } = useTranslation("codeGenerator");
  const triggerId = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={triggerId}>{t("targetLabel")}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          const target = CODE_TARGETS.find((candidate) => candidate === next);
          if (target !== undefined) {
            onChange(target);
          }
        }}
      >
        <SelectTrigger id={triggerId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CODE_TARGETS.map((target) => (
            <SelectItem key={target} value={target}>
              {t(`targets.${target}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
