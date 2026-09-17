import { enSyncCloudStatus } from "./sync/cloud-status";
import { enSyncConflictDialog } from "./sync/conflict-dialog";
import { enSyncDeletedInCloudDialog } from "./sync/deleted-in-cloud-dialog";
import { enSyncOpenSchema } from "./sync/open-schema";
import { enSyncSchemaList } from "./sync/schema-list";
import { enSyncSignOutDialog } from "./sync/sign-out-dialog";
import { enSyncUploadDialog } from "./sync/upload-dialog";

export const enSync = {
  openSchema: enSyncOpenSchema,
  cloudStatus: enSyncCloudStatus,
  uploadDialog: enSyncUploadDialog,
  conflictDialog: enSyncConflictDialog,
  deletedInCloudDialog: enSyncDeletedInCloudDialog,
  schemaList: enSyncSchemaList,
  signOutDialog: enSyncSignOutDialog,
} as const;
