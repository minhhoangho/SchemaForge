import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAuthSignIn } from "@/lib/i18n/locales/en/auth/sign-in";

export const viAuthSignIn = {
  pageTitle: "Đăng nhập – {{appName}}",
  title: "Đăng nhập",
  submit: "Đăng nhập",
  noPasswordRecovery: "Chưa có chức năng khôi phục mật khẩu.",
  toSignUp: "Chưa có tài khoản? Tạo tài khoản",
} as const satisfies LocaleNamespace<typeof enAuthSignIn>;
