import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSyncSchemaList } from "@/lib/i18n/locales/en/sync/schema-list";

export const viSyncSchemaList = {
  ownedSection: "Schema của bạn",
  guestSection: "Chỉ trên trình duyệt này",
  signInToSave: "Đăng nhập để lưu schema lên cloud",
  labels: {
    notDownloaded: "Chưa tải về trình duyệt này",
    pending: "Chưa đồng bộ",
    conflict: "Xung đột",
    deletedInCloud: "Đã bị xóa trên cloud",
  },
  sessionExpiredBanner: "Phiên đăng nhập đã hết",
  cloudListFailed: "Không tải được danh sách trên cloud",
  retry: "Thử lại",
  loadingCloud: "Đang tải danh sách trên cloud…",
  signInAgain: "Đăng nhập lại",
  deleteNeedsNetwork: "Cần kết nối mạng để xóa schema trên cloud",
  saveToCloud: "Lưu lên cloud",
  deleteCloudDescription:
    "Schema bị xóa khỏi tài khoản trên cloud và khỏi trình duyệt này. Không hoàn tác được.",
} as const satisfies LocaleNamespace<typeof enSyncSchemaList>;
