import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSyncDeletedInCloudDialog } from "@/lib/i18n/locales/en/sync/deleted-in-cloud-dialog";

export const viSyncDeletedInCloudDialog = {
  title: "Schema đã bị xóa trên cloud",
  description:
    "Schema này đã bị xóa trên cloud trong khi bạn có thay đổi chưa lưu. Hãy chọn một trong hai lựa chọn dưới đây.",
  recreate: "Tạo lại trên cloud",
  removeLocal: "Xóa khỏi trình duyệt này",
} as const satisfies LocaleNamespace<typeof enSyncDeletedInCloudDialog>;
