import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAiErrors } from "@/lib/i18n/locales/en/ai/errors";

// Vietnamese has a single plural form, so both plural keys read the same; the
// `_one` key is kept only so vi has exactly the keys of en.
export const viAiErrors = {
  "ai-upstream-busy": "Dịch vụ AI đang bận. Hãy thử lại sau ít phút.",
  "ai-upstream-failed": "Dịch vụ AI không thể trả lời. Hãy thử lại.",
  "ai-timeout": "Dịch vụ AI trả lời quá lâu. Hãy thử lại.",
  "ai-output-invalid":
    "Câu trả lời của AI không hợp lệ nên đã bị bỏ. Hãy thử lại.",
  "internal-error": "Đã xảy ra lỗi. Hãy thử lại.",
  network: "Không kết nối được tới máy chủ. Hãy kiểm tra kết nối mạng.",
  timeout: "Yêu cầu mất quá nhiều thời gian. Hãy thử lại.",
  "invalid-response": "Máy chủ trả về phản hồi không mong đợi.",
  retry: "Thử lại",
  rateLimited_one: "Quá nhiều yêu cầu. Thử lại sau {{count}} giây.",
  rateLimited_other: "Quá nhiều yêu cầu. Thử lại sau {{count}} giây.",
} as const satisfies LocaleNamespace<typeof enAiErrors>;
