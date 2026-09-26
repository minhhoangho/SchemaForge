import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSyncConflictDialog } from "@/lib/i18n/locales/en/sync/conflict-dialog";

export const viSyncConflictDialog = {
  title: "Schema đã được sửa ở nơi khác",
  description:
    "Bản trên cloud đã thay đổi từ lần đồng bộ gần nhất của máy này. Hãy chọn bản muốn giữ.",
  localVersion: "Bản trên máy này",
  cloudVersion: "Bản trên cloud",
  updatedAt: "Sửa lúc {{time}}",
  tableCount_one: "{{count}} bảng",
  tableCount_other: "{{count}} bảng",
  columnCount_one: "{{count}} cột",
  columnCount_other: "{{count}} cột",
  loadingCloud: "Đang tải bản trên cloud",
  keepLocal: "Giữ bản trên máy này",
  useCloud: "Dùng bản trên cloud",
  switchedToCloud: "Đã chuyển sang bản trên cloud",
} as const satisfies LocaleNamespace<typeof enSyncConflictDialog>;
