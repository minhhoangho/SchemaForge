import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAiQuickActions } from "@/lib/i18n/locales/en/ai/quick-actions";

export const viAiQuickActions = {
  label: "Thao tác nhanh",
  improve: "Cải thiện",
  explain: "Giải thích",
  findIssues: "Tìm lỗi",
  sampleData: "Dữ liệu mẫu",
  improveMessage: "Hãy gợi ý cải thiện cho schema này.",
  explainMessage: "Hãy giải thích schema này: các bảng, cột và quan hệ.",
  findIssuesMessage: "Hãy tìm lỗi thiết kế trong schema này.",
  sampleDataMessage: "Hãy sinh dữ liệu mẫu cho schema này.",
} as const satisfies LocaleNamespace<typeof enAiQuickActions>;
