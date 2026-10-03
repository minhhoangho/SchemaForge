import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAiDiff } from "@/lib/i18n/locales/en/ai/diff";

export const viAiDiff = {
  added: "Mới",
  changed: "Đã sửa",
  removed: "Bị xóa",
  columnAdded: "Cột mới",
  columnChanged: "Cột đã sửa",
  columnRemoved: "Cột bị xóa",
  elementLabel: "{{label}}, {{state}}",
} as const satisfies LocaleNamespace<typeof enAiDiff>;
