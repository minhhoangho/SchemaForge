"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/class-names";
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
};

type Tone = { readonly text: string; readonly dot: string };

const PILL_CLASS_NAME =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium";

function toTone(kind: CloudStatusView["kind"]): Tone {
  switch (kind) {
    case "failed":
    case "conflict":
    case "deleted-in-cloud":
      return { text: "text-destructive", dot: "bg-destructive" };
    case "synced":
      return { text: "text-success", dot: "bg-success" };
    case "unsynced":
    case "unsynced-session-expired":
      return { text: "text-warning", dot: "bg-warning" };
    case "local-only":
    case "syncing":
      return { text: "text-muted-foreground", dot: "bg-muted-foreground" };
    default: {
      const unhandledKind: never = kind;
      return unhandledKind;
    }
  }
}

function quiet(labelKey: CloudStatusKey): BadgeText {
  return { labelKey, failure: null, isAnnounced: false };
}

function announced(labelKey: CloudStatusKey): BadgeText {
  return { labelKey, failure: null, isAnnounced: true };
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
      );
    case "unsynced-session-expired":
      return announced("pendingSessionExpired");
    case "conflict":
      return announced("conflict");
    case "deleted-in-cloud":
      return announced("deletedInCloud");
    case "failed":
      return {
        labelKey: "failed",
        failure: status.failure,
        isAnnounced: true,
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
  const tone = toTone(status.kind);
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
      <p className={cn(PILL_CLASS_NAME, tone.text)}>
        <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
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
