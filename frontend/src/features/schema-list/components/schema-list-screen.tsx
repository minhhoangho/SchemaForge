"use client";

// This module is the client entry of the `/` route. Zod reads `jitless` when a
// schema is created, and modules below create schemas on import (core, storage
// records), so the configuration must load first or the CSP blocks Zod's eval.
import "@/lib/zod-config";

import type { JSX, ReactNode, RefObject } from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSwitch } from "@/components/language-switch";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchemaActions } from "@/features/schema-list/hooks/use-schema-actions";
import {
  getSchemaListEntryId,
  useSchemaList,
} from "@/features/schema-list/hooks/use-schema-list";
import { useSchemaListDialogs } from "@/features/schema-list/hooks/use-schema-list-dialogs";
import type { SchemaListDialogs as SchemaListDialogsState } from "@/features/schema-list/hooks/use-schema-list-dialogs";
import { APP_NAME } from "@/lib/app-name";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import type { SchemaListEntry } from "@/lib/storage/schema-repository";
import { useStorage } from "@/lib/storage/storage-context";
import type { StorageErrorCode } from "@/lib/storage/storage-error";

import { SchemaListDialogs } from "./schema-list-dialogs";
import { SchemaListRow } from "./schema-list-row";

const SKELETON_ROW_KEYS = ["first", "second", "third"] as const;

// Children are grid items: an optional action placed beside the heading, then
// content spanning the full width. The layout stays mounted while storage
// changes state, so the header and heading never remount.
const ACTION_CLASS_NAME = "justify-self-end";
const CONTENT_CLASS_NAME = "col-span-2";

type ScreenLayoutProps = {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly children: ReactNode;
};

function ScreenLayout({
  headingRef,
  children,
}: ScreenLayoutProps): JSX.Element {
  const { t } = useTranslation("schemaList");

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2">
        <span className="font-semibold">{APP_NAME}</span>
        <div className="flex items-center gap-1">
          <ThemeSwitch />
          <LanguageSwitch />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-3xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-6 p-4 sm:p-6">
        {/* tabIndex -1 lets focus land here after the focused row is deleted. */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("title")}
        </h1>
        {children}
      </main>
    </>
  );
}

function SchemaListSkeleton(): JSX.Element {
  const { t } = useTranslation("schemaList");

  return (
    <div role="status" className={`${CONTENT_CLASS_NAME} flex flex-col gap-3`}>
      <span className="sr-only">{t("loading")}</span>
      {SKELETON_ROW_KEYS.map((key) => (
        <Skeleton
          key={key}
          className="h-16 w-full motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

type StorageMessageProps = {
  readonly errorCode: StorageErrorCode;
};

function StorageMessage({ errorCode }: StorageMessageProps): JSX.Element {
  const { t } = useTranslation("storage");

  return (
    <p className={`${CONTENT_CLASS_NAME} text-destructive`}>{t(errorCode)}</p>
  );
}

type SchemaEntriesProps = {
  readonly entries: readonly SchemaListEntry[];
  readonly dialogs: SchemaListDialogsState;
};

function SchemaEntries({ entries, dialogs }: SchemaEntriesProps): JSX.Element {
  const { t } = useTranslation("schemaList");

  if (entries.length === 0) {
    return (
      <div className={`${CONTENT_CLASS_NAME} flex flex-col items-start gap-3`}>
        <p className="text-muted-foreground">{t("empty.title")}</p>
        <Button
          onClick={(event) => {
            dialogs.open({ kind: "create" }, event.currentTarget);
          }}
        >
          {t("empty.createFirst")}
        </Button>
      </div>
    );
  }

  return (
    <ul className={`${CONTENT_CLASS_NAME} flex flex-col gap-3`}>
      {entries.map((entry) => (
        <SchemaListRow
          key={getSchemaListEntryId(entry)}
          entry={entry}
          onRename={(schema, trigger) => {
            dialogs.open({ kind: "rename", schema }, trigger);
          }}
          onDelete={(deleted, trigger) => {
            dialogs.open({ kind: "delete", entry: deleted }, trigger);
          }}
        />
      ))}
    </ul>
  );
}

type ReadySchemaListProps = {
  readonly storage: StorageBundle;
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
};

function ReadySchemaList({
  storage,
  headingRef,
}: ReadySchemaListProps): JSX.Element {
  const { t } = useTranslation("schemaList");
  const result = useSchemaList(storage.repository);
  const actions = useSchemaActions(storage);
  const dialogs = useSchemaListDialogs(headingRef);

  if (result?.kind === "failed") {
    return <StorageMessage errorCode={result.errorCode} />;
  }

  return (
    <>
      <Button
        className={ACTION_CLASS_NAME}
        onClick={(event) => {
          dialogs.open({ kind: "create" }, event.currentTarget);
        }}
      >
        {t("create.trigger")}
      </Button>
      {result === undefined ? (
        <SchemaListSkeleton />
      ) : (
        <SchemaEntries entries={result.entries} dialogs={dialogs} />
      )}
      <SchemaListDialogs dialogs={dialogs} actions={actions} />
    </>
  );
}

type ScreenContentProps = {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
};

function ScreenContent({ headingRef }: ScreenContentProps): JSX.Element {
  const { t } = useTranslation("schemaList");
  const storage = useStorage();

  switch (storage.kind) {
    case "ready":
      return (
        <ReadySchemaList storage={storage.storage} headingRef={headingRef} />
      );
    case "pending":
      return (
        <>
          <Button className={ACTION_CLASS_NAME} disabled>
            {t("create.trigger")}
          </Button>
          <SchemaListSkeleton />
        </>
      );
    case "unavailable":
      return <StorageMessage errorCode={storage.errorCode} />;
    default: {
      const unhandledState: never = storage;
      return unhandledState;
    }
  }
}

export function SchemaListScreen(): JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null);

  return (
    <ScreenLayout headingRef={headingRef}>
      <ScreenContent headingRef={headingRef} />
    </ScreenLayout>
  );
}
