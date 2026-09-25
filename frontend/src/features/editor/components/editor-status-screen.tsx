"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { StorageErrorCode } from "@/lib/storage/storage-error";

export type EditorStatusVariant =
  | "not-found"
  | "locked"
  | "unsupported-version"
  | "unreadable"
  | "storage-unavailable"
  | "needs-network"
  | "deleted-elsewhere";

export type EditorStatusScreenProps = {
  readonly variant: EditorStatusVariant;
  readonly storageErrorCode?: StorageErrorCode;
  /** Shown as a retry button on the needs-network screen. */
  readonly onRetry?: () => void;
  /** Offers signing in on the not-found screen when given. */
  readonly signInHref?: string;
};

// Whole keys rather than keys built from the variant, so i18next's key types
// still check every one of them.
const STATUS_KEYS = {
  "not-found": {
    titleKey: "screen.notFound.title",
    descriptionKey: "screen.notFound.description",
  },
  locked: {
    titleKey: "screen.locked.title",
    descriptionKey: "screen.locked.description",
  },
  "unsupported-version": {
    titleKey: "screen.unsupportedVersion.title",
    descriptionKey: "screen.unsupportedVersion.description",
  },
  unreadable: {
    titleKey: "screen.unreadable.title",
    descriptionKey: "screen.unreadable.description",
  },
  // The description comes from the storage error code instead.
  "storage-unavailable": {
    titleKey: "screen.storageUnavailable.title",
    descriptionKey: null,
  },
  "needs-network": {
    titleKey: "sync:openSchema.needsNetwork.title",
    descriptionKey: null,
  },
  "deleted-elsewhere": {
    titleKey: "sync:openSchema.deletedElsewhere.title",
    descriptionKey: null,
  },
} as const satisfies Record<
  EditorStatusVariant,
  { readonly titleKey: string; readonly descriptionKey: string | null }
>;

const LINK_CLASS_NAME =
  "self-start text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// The storage namespace words its unknown error for a failed save, which is
// wrong for a schema that could not be opened.
const UNKNOWN_STORAGE_ERROR_CODE: StorageErrorCode = "unknown";

/** Every state in which the editor cannot open a schema (spec section 1). */
export function EditorStatusScreen({
  variant,
  storageErrorCode = UNKNOWN_STORAGE_ERROR_CODE,
  onRetry,
  signInHref,
}: EditorStatusScreenProps): JSX.Element {
  const { t } = useTranslation(["editor", "storage", "sync"]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { titleKey, descriptionKey } = STATUS_KEYS[variant];
  function getDescription(): string | null {
    if (descriptionKey !== null) {
      return t(descriptionKey);
    }
    if (variant !== "storage-unavailable") {
      return null;
    }
    return storageErrorCode === UNKNOWN_STORAGE_ERROR_CODE
      ? t("screen.storageUnavailable.readFailed")
      : t(storageErrorCode, { ns: "storage" });
  }

  const description = getDescription();

  // This screen replaces the skeleton on the client, which drops focus to the
  // body; the heading takes it so screen readers announce what happened.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="mx-auto flex max-w-prose flex-col gap-4 p-6">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t(titleKey)}
      </h1>
      {description === null ? null : (
        <p className="text-muted-foreground">{description}</p>
      )}
      {variant === "needs-network" && onRetry !== undefined ? (
        <Button type="button" className="self-start" onClick={onRetry}>
          {t("sync:openSchema.retry")}
        </Button>
      ) : null}
      {variant === "not-found" && signInHref !== undefined ? (
        <Link href={signInHref} className={LINK_CLASS_NAME}>
          {t("sync:openSchema.notFoundSignIn")}
        </Link>
      ) : null}
      <Link href="/" className={LINK_CLASS_NAME}>
        {t("screen.backToList")}
      </Link>
    </main>
  );
}
