import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAiComposer } from "@/lib/i18n/locales/en/ai/composer";

export const viAiComposer = {
  label: "Tin nhắn gửi trợ lý AI",
  placeholder: "Mô tả một schema hoặc yêu cầu thay đổi",
  send: "Gửi",
  stop: "Dừng",
  counter: "{{count}}/{{max}}",
} as const satisfies LocaleNamespace<typeof enAiComposer>;
