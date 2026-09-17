import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAuthCredentialsForm } from "@/lib/i18n/locales/en/auth/credentials-form";

export const viAuthCredentialsForm = {
  emailLabel: "Email",
  passwordLabel: "Mật khẩu",
  showPassword: "Hiện mật khẩu",
  hidePassword: "Ẩn mật khẩu",
  submitting: "Đang gửi…",
  errors: {
    emailRequired: "Hãy nhập email.",
    emailInvalid: "Email không hợp lệ.",
    emailTooLong: "Email tối đa {{max}} ký tự.",
    passwordTooShort: "Mật khẩu tối thiểu {{min}} ký tự.",
    passwordTooLong: "Mật khẩu tối đa {{max}} ký tự.",
  },
} as const satisfies LocaleNamespace<typeof enAuthCredentialsForm>;
