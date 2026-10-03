import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAiStatus } from "@/lib/i18n/locales/en/ai/status";

export const viAiStatus = {
  responding: "Trợ lý đang trả lời",
  done: "Trợ lý đã trả lời xong",
  stopped: "Đã dừng câu trả lời",
} as const satisfies LocaleNamespace<typeof enAiStatus>;
