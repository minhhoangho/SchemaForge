import { PlusIcon, Table2Icon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export type CanvasEmptyStateProps = {
  readonly onAddTable: () => void;
};

export function CanvasEmptyState({
  onAddTable,
}: CanvasEmptyStateProps): JSX.Element {
  const { t } = useTranslation("canvas");

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-xl border border-dashed border-input bg-card/90 p-6 text-card-foreground shadow-sm">
        <Table2Icon aria-hidden className="size-8 text-muted-foreground" />
        <p className="text-base font-semibold">{t("empty.title")}</p>
        <Button type="button" onClick={onAddTable}>
          <PlusIcon aria-hidden />
          {t("empty.addTable")}
        </Button>
      </div>
    </div>
  );
}
