export const enSyncConflictDialog = {
  title: "This schema was changed somewhere else",
  localVersion: "Version on this device",
  cloudVersion: "Version in the cloud",
  updatedAt: "Updated {{time}}",
  counts: "{{tables}} tables, {{columns}} columns",
  keepLocal: "Keep the version on this device",
  useCloud: "Use the cloud version",
  switchedToCloud: "Switched to the cloud version",
} as const;
