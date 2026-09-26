"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { enSyncCloudStatus } from "@/lib/i18n/locales/en/sync/cloud-status";

import type {
  CloudPushFailureCode,
  CloudStatusView,
} from "../../lib/to-cloud-status-view";

export type CloudDialogKind = "conflict" | "deleted-in-cloud";

export type CloudStatusBadgeProps = {
  readonly status: CloudStatusView;
  readonly onRetry: () => void;
  readonly onSaveToCloud: () => void;
  readonly onOpenCloudDialog: (
    kind: CloudDialogKind,
    trigger: HTMLElement,
  ) => void;
};

type CloudStatusKey = keyof typeof enSyncCloudStatus;

type BadgeText = {
  readonly labelKey: CloudStatusKey;
  readonly failure: CloudPushFailureCode | null;
  readonly isAnnounced: boolean;
  readonly isError: boolean;
};

function quiet(labelKey: CloudStatusKey): BadgeText {
  return { labelKey, failure: null, isAnnounced: false, isError: false };
}

function announced(labelKey: CloudStatusKey, isError: boolean): BadgeText {
  return { labelKey, failure: null, isAnnounced: true, isError };
}

function toBadgeText(status: CloudStatusView): BadgeText {
  switch (status.kind) {
    case "local-only":
      return quiet("guestOnly");
    case "synced":
      return quiet("synced");
    case "syncing":
      return quiet("syncing");
    case "unsynced":
      return announced(
        status.reason === "offline" ? "pendingOffline" : "pendingServer",
        false,
      );
    case "unsynced-session-expired":
      return announced("pendingSessionExpired", false);
    case "conflict":
      return announced("conflict", true);
    case "deleted-in-cloud":
      return announced("deletedInCloud", true);
    case "failed":
      return {
        labelKey: "failed",
        failure: status.failure,
        isAnnounced: true,
        isError: true,
      };
    default: {
      const unhandledStatus: never = status;
      return unhandledStatus;
    }
  }
}

type BadgeActionProps = Omit<CloudStatusBadgeProps, "status"> & {
  readonly kind: CloudStatusView["kind"];
};

function BadgeAction({
  kind,
  onRetry,
  onSaveToCloud,
  onOpenCloudDialog,
}: BadgeActionProps): JSX.Element | null {
  const { t } = useTranslation("sync");

  switch (kind) {
    case "local-only":
      return (
        <Button variant="outline" size="sm" onClick={onSaveToCloud}>
          {t("cloudStatus.saveToCloud")}
        </Button>
      );
    case "conflict":
    case "deleted-in-cloud":
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            onOpenCloudDialog(kind, event.currentTarget);
          }}
        >
          {t(
            kind === "conflict"
              ? "cloudStatus.resolve"
              : "cloudStatus.viewOptions",
          )}
        </Button>
      );
    case "failed":
      return (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("cloudStatus.retry")}
        </Button>
      );
    case "synced":
    case "syncing":
    case "unsynced":
    case "unsynced-session-expired":
      return null;
    default: {
      const unhandledKind: never = kind;
      return unhandledKind;
    }
  }
}

/**
 * Where the local save status sits while local saving works. Only states the
 * user must act on or know about are announced; syncing and synced change on
 * every push and would interrupt constantly (WCAG 4.1.3).
 */
export function CloudStatusBadge({
  status,
  ...actions
}: CloudStatusBadgeProps): JSX.Element {
  const { t } = useTranslation("sync");
  const { t: translateApiError } = useTranslation("apiErrors");
  const text = toBadgeText(status);
  const label = t(`cloudStatus.${text.labelKey}`);
  // version-unsupported is not an ApiErrorCode, so it has its own message.
  let detail: string | null = null;
  if (text.failure === "version-unsupported") {
    detail = t("cloudStatus.versionUnsupported");
  } else if (text.failure !== null) {
    detail = translateApiError(text.failure);
  }

  return (
    <div className="flex items-center gap-1.5">
      <p
        className={
          text.isError
            ? "text-sm text-destructive"
            : "text-sm text-muted-foreground"
        }
      >
        <span>{label}</span>
        {detail === null ? null : <span className="ml-1">{detail}</span>}
      </p>
      <span role="status" className="sr-only">
        {text.isAnnounced ? [label, detail].filter(Boolean).join(" ") : ""}
      </span>
      <BadgeAction kind={status.kind} {...actions} />
    </div>
  );
}
