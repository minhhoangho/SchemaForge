import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSync } from "@/lib/i18n/locales/en/sync";

import { viSyncCloudStatus } from "./sync/cloud-status";
import { viSyncConflictDialog } from "./sync/conflict-dialog";
import { viSyncDeletedInCloudDialog } from "./sync/deleted-in-cloud-dialog";
import { viSyncOpenSchema } from "./sync/open-schema";
import { viSyncSchemaList } from "./sync/schema-list";
import { viSyncSignOutDialog } from "./sync/sign-out-dialog";
import { viSyncUploadDialog } from "./sync/upload-dialog";

export const viSync = {
  openSchema: viSyncOpenSchema,
  cloudStatus: viSyncCloudStatus,
  uploadDialog: viSyncUploadDialog,
  conflictDialog: viSyncConflictDialog,
  deletedInCloudDialog: viSyncDeletedInCloudDialog,
  schemaList: viSyncSchemaList,
  signOutDialog: viSyncSignOutDialog,
} as const satisfies LocaleNamespace<typeof enSync>;
