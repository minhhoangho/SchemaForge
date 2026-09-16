"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { StorageErrorCode } from "@/lib/storage/storage-error";

export type EditorStatusVariant =
  | "not-found"
  | "locked"
  | "unsupported-version"
  | "unreadable"
  | "storage-unavailable";

export type EditorStatusScreenProps = {
  readonly variant: EditorStatusVariant;
  readonly storageErrorCode?: StorageErrorCode;
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
  "storage-unavailable": {
    titleKey: "screen.storageUnavailable.title",
    descriptionKey: null,
  },
} as const satisfies Record<
  EditorStatusVariant,
  { readonly titleKey: string; readonly descriptionKey: string | null }
>;

// The storage namespace words its unknown error for a failed save, which is
// wrong for a schema that could not be opened.
const UNKNOWN_STORAGE_ERROR_CODE: StorageErrorCode = "unknown";

/** Every state in which the editor cannot open a schema (spec section 1). */
export function EditorStatusScreen({
  variant,
  storageErrorCode = UNKNOWN_STORAGE_ERROR_CODE,
}: EditorStatusScreenProps): JSX.Element {
  const { t } = useTranslation(["editor", "storage"]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { titleKey, descriptionKey } = STATUS_KEYS[variant];
  function getDescription(): string {
    if (descriptionKey !== null) {
      return t(descriptionKey);
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
      <p className="text-muted-foreground">{description}</p>
      <Link
        href="/"
        className="self-start text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("screen.backToList")}
      </Link>
    </main>
  );
}
