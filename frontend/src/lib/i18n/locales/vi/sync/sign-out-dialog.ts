import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSyncSignOutDialog } from "@/lib/i18n/locales/en/sync/sign-out-dialog";

export const viSyncSignOutDialog = {
  title: "Đăng xuất?",
  description_one:
    "{{count}} schema có thay đổi chưa lưu lên cloud. Đăng xuất sẽ xóa nó khỏi trình duyệt này.",
  description_other:
    "{{count}} schema có thay đổi chưa lưu lên cloud. Đăng xuất sẽ xóa chúng khỏi trình duyệt này.",
  allSynced: "Mọi thay đổi đã lưu lên cloud.",
  trySync: "Thử đồng bộ",
  signOutAnyway: "Vẫn đăng xuất",
  signOut: "Đăng xuất",
  cancel: "Hủy",
  syncing: "Đang đồng bộ…",
  syncStoppedExpired:
    "Phiên đăng nhập đã hết hạn, hãy đăng nhập lại để đồng bộ.",
  syncStoppedConflict_one:
    "{{count}} schema đang xung đột với bản trên cloud, hãy mở để xử lý.",
  syncStoppedConflict_other:
    "{{count}} schema đang xung đột với bản trên cloud, hãy mở để xử lý.",
  signingOut: "Đang đăng xuất…",
  signOutFailed: "Không đăng xuất được, hãy kiểm tra kết nối",
  cacheCleanupFailed:
    "Đã đăng xuất nhưng không xóa hết dữ liệu trên trình duyệt này",
} as const satisfies LocaleNamespace<typeof enSyncSignOutDialog>;
