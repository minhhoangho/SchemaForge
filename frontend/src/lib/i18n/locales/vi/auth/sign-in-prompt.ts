import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAuthSignInPrompt } from "@/lib/i18n/locales/en/auth/sign-in-prompt";

export const viAuthSignInPrompt = {
  title: "Tính năng này cần tài khoản",
  reasons: {
    cloudSave: "Đăng nhập để lưu schema này lên cloud.",
    cloudSchema: "Schema này có thể đang nằm trên cloud. Đăng nhập để xem.",
  },
  signIn: "Đăng nhập",
  signUp: "Tạo tài khoản",
  later: "Để sau",
} as const satisfies LocaleNamespace<typeof enAuthSignInPrompt>;
