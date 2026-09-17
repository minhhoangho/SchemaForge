import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAuthSignUp } from "@/lib/i18n/locales/en/auth/sign-up";

export const viAuthSignUp = {
  pageTitle: "Đăng ký – {{appName}}",
  title: "Tạo tài khoản",
  submit: "Tạo tài khoản",
  noEmailVerification: "Tài khoản dùng được ngay, không cần xác minh email.",
  toSignIn: "Đã có tài khoản? Đăng nhập",
} as const satisfies LocaleNamespace<typeof enAuthSignUp>;
