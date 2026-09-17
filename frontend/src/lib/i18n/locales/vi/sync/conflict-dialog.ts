import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSyncConflictDialog } from "@/lib/i18n/locales/en/sync/conflict-dialog";

export const viSyncConflictDialog = {
  title: "Schema đã được sửa ở nơi khác",
  localVersion: "Bản trên máy này",
  cloudVersion: "Bản trên cloud",
  updatedAt: "Sửa lúc {{time}}",
  counts: "{{tables}} bảng, {{columns}} cột",
  keepLocal: "Giữ bản trên máy này",
  useCloud: "Dùng bản trên cloud",
  switchedToCloud: "Đã chuyển sang bản trên cloud",
} as const satisfies LocaleNamespace<typeof enSyncConflictDialog>;
