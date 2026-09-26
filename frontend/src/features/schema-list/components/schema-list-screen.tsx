"use client";

// This module is the client entry of the `/` route. Zod reads `jitless` when a
// schema is created, and modules below create schemas on import (core, storage
// records), so the configuration must load first or the CSP blocks Zod's eval.
import "@/lib/zod-config";

import type { JSX, ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { AccountMenu } from "@/components/account-menu";
import { useApiClient, useAuth } from "@/components/auth-provider";
import { LanguageSwitch } from "@/components/language-switch";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCloudSchemaList } from "@/features/schema-list/hooks/use-cloud-schema-list";
import type { CloudSchemaListState } from "@/features/schema-list/hooks/use-cloud-schema-list";
import { useSchemaActions } from "@/features/schema-list/hooks/use-schema-actions";
import {
  getSchemaListEntryId,
  useSchemaList,
} from "@/features/schema-list/hooks/use-schema-list";
import { useSchemaListDialogs } from "@/features/schema-list/hooks/use-schema-list-dialogs";
import type { SchemaListDialogs as SchemaListDialogsState } from "@/features/schema-list/hooks/use-schema-list-dialogs";
import { removeStaleCache } from "@/features/schema-list/lib/remove-stale-cache";
import { APP_NAME } from "@/lib/app-name";
import type { AuthState } from "@/lib/auth/auth-store";
import { logger } from "@/lib/logger";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import type { SchemaListEntry } from "@/lib/storage/schema-repository";
import { useStorage } from "@/lib/storage/storage-context";
import type { StorageErrorCode } from "@/lib/storage/storage-error";
import type { MergedSchemaList } from "@/lib/sync/merge-schema-list";
import { syncPendingSchemas } from "@/lib/sync/sync-pending-schemas";

import { CloudListBanner } from "./cloud-list-banner";
import { SchemaListDialogs } from "./schema-list-dialogs";
import { SchemaListRow } from "./schema-list-row";
import { SchemaListSection } from "./schema-list-section";
import { SessionExpiredBanner } from "./session-expired-banner";
import { SignInInvite } from "./sign-in-invite";

const SKELETON_ROW_KEYS = ["first", "second", "third"] as const;
const NO_SCHEMA_IDS: readonly string[] = [];

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
          <AccountMenu />
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
          kind="guest"
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

function CloudListSkeleton(): JSX.Element {
  const { t } = useTranslation("sync");

  return (
    <div role="status">
      <span className="sr-only">{t("schemaList.loadingCloud")}</span>
      <Skeleton
        aria-hidden="true"
        className="h-16 w-full motion-reduce:animate-none"
      />
    </div>
  );
}

type OwnedSectionProps = {
  readonly rows: Extract<MergedSchemaList["owned"], { kind: "rows" }>["rows"];
  readonly isCloudLoading: boolean;
};

function OwnedSection({
  rows,
  isCloudLoading,
}: OwnedSectionProps): JSX.Element {
  const { t } = useTranslation("sync");

  return (
    <SchemaListSection title={t("schemaList.ownedSection")}>
      {rows.length === 0 ? null : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <SchemaListRow key={row.id} kind="owned" row={row} />
          ))}
        </ul>
      )}
      {isCloudLoading ? <CloudListSkeleton /> : null}
    </SchemaListSection>
  );
}

type SchemaSectionsProps = {
  readonly auth: AuthState;
  readonly list: MergedSchemaList;
  readonly cloud: CloudSchemaListState;
  readonly onRetryCloud: () => void;
  readonly dialogs: SchemaListDialogsState;
};

// Which parts show for each auth state: auth-cloud spec section 7, "Danh
// sách schema". While auth is unknown only the guest part shows.
function SchemaSections({
  auth,
  list,
  cloud,
  onRetryCloud,
  dialogs,
}: SchemaSectionsProps): JSX.Element {
  const { t } = useTranslation("sync");
  const ownedRows =
    list.owned.kind === "rows" && auth.status !== "unknown"
      ? list.owned.rows
      : null;
  const isCloudLoading = cloud.kind === "loading";
  const isEmpty =
    (ownedRows?.length ?? 0) === 0 &&
    list.guest.length === 0 &&
    !isCloudLoading;

  return (
    <>
      {auth.status === "expired" ? <SessionExpiredBanner /> : null}
      {cloud.kind === "failed" ? (
        <CloudListBanner failure={cloud.failure} onRetry={onRetryCloud} />
      ) : null}
      {auth.status === "signed-out" ? <SignInInvite /> : null}
      {ownedRows === null || isEmpty ? (
        <SchemaEntries entries={list.guest} dialogs={dialogs} />
      ) : (
        <>
          <OwnedSection rows={ownedRows} isCloudLoading={isCloudLoading} />
          {list.guest.length === 0 ? null : (
            <SchemaListSection title={t("schemaList.guestSection")}>
              <SchemaEntries entries={list.guest} dialogs={dialogs} />
            </SchemaListSection>
          )}
        </>
      )}
    </>
  );
}

function useCloudHousekeeping(input: {
  readonly storage: StorageBundle;
  readonly auth: AuthState;
  readonly staleCacheIds: readonly string[];
}): void {
  const { storage, auth, staleCacheIds } = input;
  const api = useApiClient();
  const signedInUserId = auth.status === "signed-in" ? auth.user.id : null;

  useEffect(() => {
    if (staleCacheIds.length === 0) {
      return;
    }
    // removeStaleCache logs its own failures and never rejects.
    void removeStaleCache({
      schemaIds: staleCacheIds,
      repository: storage.repository,
      lockManager: storage.lockManager,
    });
  }, [staleCacheIds, storage]);

  // Spec section 7, "Đồng bộ nền": pending schemas are pushed when the list
  // mounts signed in; overlapping runs share one promise.
  useEffect(() => {
    if (signedInUserId === null) {
      return;
    }
    syncPendingSchemas({
      api,
      repository: storage.repository,
      lockManager: storage.lockManager,
      userId: signedInUserId,
    }).catch((cause: unknown) => {
      logger.error("schema-list.sync-failed", {
        errorName: cause instanceof Error ? cause.name : "unknown",
      });
    });
  }, [api, storage, signedInUserId]);
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
  const auth = useAuth((state) => state.auth);
  const cloud = useCloudSchemaList({
    apiClient: useApiClient(),
    authStatus: auth.status,
  });
  const result = useSchemaList({
    repository: storage.repository,
    auth,
    cloud: cloud.state,
  });
  const actions = useSchemaActions(storage);
  const dialogs = useSchemaListDialogs(headingRef);
  useCloudHousekeeping({
    storage,
    auth,
    staleCacheIds:
      result?.kind === "loaded" ? result.list.staleCacheIds : NO_SCHEMA_IDS,
  });

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
        <SchemaSections
          auth={auth}
          list={result.list}
          cloud={cloud.state}
          onRetryCloud={cloud.reload}
          dialogs={dialogs}
        />
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
