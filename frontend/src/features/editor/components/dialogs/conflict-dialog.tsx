"use client";

import type { JSX, ReactNode } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toApiErrorMessageKey } from "@/lib/api/api-failure";

import type {
  CloudResolution,
  CloudVersionState,
} from "../../hooks/use-cloud-resolution";
import type { SchemaVersionSummary } from "../../lib/summarize-schema-version";

export type ConflictDialogProps = {
  readonly open: boolean;
  // null until the cached version has been read.
  readonly localVersion: SchemaVersionSummary | null;
  readonly resolution: Pick<
    CloudResolution,
    | "cloudVersion"
    | "isBusy"
    | "reloadCloudVersion"
    | "keepLocal"
    | "adoptCloudVersion"
  >;
  readonly onClose: () => void;
  readonly onReturnFocus: () => void;
};

// The same format as the schema list rows.
const UPDATED_AT_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

type VersionColumnProps = {
  readonly heading: string;
  readonly children: ReactNode;
};

function VersionColumn({ heading, children }: VersionColumnProps): JSX.Element {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h3 id={headingId} className="text-sm font-medium">
        {heading}
      </h3>
      {children}
    </section>
  );
}

function VersionSummary({
  summary,
}: {
  readonly summary: SchemaVersionSummary;
}): JSX.Element {
  const { t, i18n } = useTranslation("sync");
  const time = new Intl.DateTimeFormat(i18n.language, UPDATED_AT_FORMAT).format(
    summary.updatedAt,
  );

  return (
    <ul className="text-sm text-muted-foreground">
      <li>{t("conflictDialog.updatedAt", { time })}</li>
      <li>{t("conflictDialog.tableCount", { count: summary.tableCount })}</li>
      <li>{t("conflictDialog.columnCount", { count: summary.columnCount })}</li>
    </ul>
  );
}

function LoadingSummary(): JSX.Element {
  const { t } = useTranslation("sync");

  return (
    <>
      <Skeleton aria-hidden className="h-14 w-full" />
      <span className="sr-only">{t("conflictDialog.loadingCloud")}</span>
    </>
  );
}

type CloudSummaryProps = {
  readonly cloudVersion: CloudVersionState;
  readonly onRetry: () => void;
};

function CloudSummary({
  cloudVersion,
  onRetry,
}: CloudSummaryProps): JSX.Element {
  const { t } = useTranslation(["apiErrors", "common", "editor"]);

  switch (cloudVersion.kind) {
    case "loading":
      return <LoadingSummary />;
    case "loaded":
      return <VersionSummary summary={cloudVersion.summary} />;
    case "version-unsupported":
      return (
        <p className="text-sm text-destructive">
          {t("editor:screen.unsupportedVersion.description")}
        </p>
      );
    case "failed":
      return (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-destructive">
            {t(`apiErrors:${toApiErrorMessageKey(cloudVersion.failure)}`)}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("common:actions.retry")}
          </Button>
        </div>
      );
    default: {
      const unhandledVersion: never = cloudVersion;
      return unhandledVersion;
    }
  }
}

/**
 * Asks which version of a schema edited in two places wins (spec section 7,
 * "Xung đột"). Closing leaves the conflict as it is; the toolbar reopens it.
 */
export function ConflictDialog({
  open,
  localVersion,
  resolution,
  onClose,
  onReturnFocus,
}: ConflictDialogProps): JSX.Element {
  const { t } = useTranslation(["sync", "common"]);
  const { cloudVersion, isBusy } = resolution;
  const canChoose = cloudVersion.kind === "loaded" && !isBusy;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <AlertDialogContent
        className="data-[size=default]:sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          // Opened from the toolbar or by the pusher, never by a trigger of
          // its own, so the workspace names where focus goes back to.
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("conflictDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("conflictDialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <VersionColumn heading={t("conflictDialog.localVersion")}>
            {localVersion === null ? (
              <Skeleton aria-hidden className="h-14 w-full" />
            ) : (
              <VersionSummary summary={localVersion} />
            )}
          </VersionColumn>
          <VersionColumn heading={t("conflictDialog.cloudVersion")}>
            <CloudSummary
              cloudVersion={cloudVersion}
              onRetry={resolution.reloadCloudVersion}
            />
          </VersionColumn>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common:actions.close")}</AlertDialogCancel>
          <Button
            variant="outline"
            disabled={!canChoose}
            onClick={() => {
              // The hook reports its own failures.
              void resolution.keepLocal();
            }}
          >
            {t("conflictDialog.keepLocal")}
          </Button>
          <Button
            disabled={!canChoose}
            onClick={() => {
              // The hook reports its own failures.
              void resolution.adoptCloudVersion();
            }}
          >
            {t("conflictDialog.useCloud")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
