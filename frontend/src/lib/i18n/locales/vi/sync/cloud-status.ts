import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSyncCloudStatus } from "@/lib/i18n/locales/en/sync/cloud-status";

export const viSyncCloudStatus = {
  guestOnly: "Chỉ lưu trên trình duyệt này",
  saveToCloud: "Lưu lên cloud",
  synced: "Đã lưu lên cloud",
  syncing: "Đang đồng bộ…",
  pendingOffline: "Chưa đồng bộ, mất kết nối mạng",
  pendingServer: "Chưa đồng bộ, máy chủ không phản hồi",
  pendingSessionExpired: "Chưa đồng bộ, hãy đăng nhập lại",
  conflict: "Xung đột",
  resolve: "Giải quyết",
  deletedInCloud: "Đã bị xóa trên cloud",
  viewOptions: "Xem lựa chọn",
  failed: "Không đồng bộ được",
  retry: "Thử lại",
  versionUnsupported: "Máy chủ chưa hỗ trợ phiên bản dữ liệu này",
} as const satisfies LocaleNamespace<typeof enSyncCloudStatus>;
