import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAiFindings } from "@/lib/i18n/locales/en/ai/findings";

export const viAiFindings = {
  title: "Kết quả đánh giá",
  kinds: {
    suggestion: "Gợi ý",
    issue: "Vấn đề",
  },
  categories: {
    index: "Index",
    normalization: "Chuẩn hóa",
    naming: "Đặt tên",
    relation: "Quan hệ",
    type: "Kiểu dữ liệu",
    other: "Khác",
  },
  apply: "Áp dụng",
  fixForMe: "Sửa giúp tôi",
  applyMessage: "Hãy áp dụng gợi ý: {{title}}. {{detail}}",
  fixMessage: "Hãy sửa vấn đề: {{title}}. {{detail}}",
  targetUnavailable: "Phần này của schema không còn tồn tại.",
} as const satisfies LocaleNamespace<typeof enAiFindings>;
