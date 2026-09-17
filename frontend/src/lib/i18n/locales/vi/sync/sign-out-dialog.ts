import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSyncSignOutDialog } from "@/lib/i18n/locales/en/sync/sign-out-dialog";

export const viSyncSignOutDialog = {
  title: "Đăng xuất?",
  description_one:
    "{{count}} schema có thay đổi chưa lưu lên cloud. Đăng xuất sẽ xóa nó khỏi trình duyệt này.",
  description_other:
    "{{count}} schema có thay đổi chưa lưu lên cloud. Đăng xuất sẽ xóa chúng khỏi trình duyệt này.",
  trySync: "Thử đồng bộ",
  signOutAnyway: "Vẫn đăng xuất",
  cancel: "Hủy",
  signOutFailed: "Không đăng xuất được, hãy kiểm tra kết nối",
} as const satisfies LocaleNamespace<typeof enSyncSignOutDialog>;
