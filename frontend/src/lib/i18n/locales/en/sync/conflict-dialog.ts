export const enSyncConflictDialog = {
  title: "This schema was changed somewhere else",
  description:
    "The version in the cloud changed since this device last synced. Choose which version to keep.",
  localVersion: "Version on this device",
  cloudVersion: "Version in the cloud",
  updatedAt: "Updated {{time}}",
  tableCount_one: "{{count}} table",
  tableCount_other: "{{count}} tables",
  columnCount_one: "{{count}} column",
  columnCount_other: "{{count}} columns",
  loadingCloud: "Loading the cloud version",
  keepLocal: "Keep the version on this device",
  useCloud: "Use the cloud version",
  switchedToCloud: "Switched to the cloud version",
} as const;
