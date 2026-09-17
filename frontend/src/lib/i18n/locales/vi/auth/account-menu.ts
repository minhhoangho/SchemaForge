import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAuthAccountMenu } from "@/lib/i18n/locales/en/auth/account-menu";

export const viAuthAccountMenu = {
  signIn: "Đăng nhập",
  signOut: "Đăng xuất",
  signInAgain: "Đăng nhập lại",
  menuLabel: "Tài khoản {{email}}",
  loadingLabel: "Đang tải trạng thái đăng nhập",
} as const satisfies LocaleNamespace<typeof enAuthAccountMenu>;
