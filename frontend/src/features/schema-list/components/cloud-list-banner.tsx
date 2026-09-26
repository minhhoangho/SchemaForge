"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { toApiErrorMessageKey } from "@/lib/api/api-failure";
import type { ApiFailure } from "@/lib/api/api-failure";

type CloudListBannerProps = {
  readonly failure: ApiFailure;
  readonly onRetry: () => void;
};

export function CloudListBanner({
  failure,
  onRetry,
}: CloudListBannerProps): JSX.Element {
  const { t } = useTranslation("sync");
  const { t: translateApiError } = useTranslation("apiErrors");

  return (
    <div
      role="alert"
      className="col-span-2 flex flex-wrap items-center gap-3 rounded-lg border border-destructive p-3"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium text-destructive">
          {t("schemaList.cloudListFailed")}
        </p>
        <p className="text-sm text-muted-foreground">
          {translateApiError(toApiErrorMessageKey(failure))}
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        {t("schemaList.retry")}
      </Button>
    </div>
  );
}
