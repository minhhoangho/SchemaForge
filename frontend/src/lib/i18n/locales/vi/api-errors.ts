import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enApiErrors } from "@/lib/i18n/locales/en/api-errors";
import type { ApiErrorCode } from "@schemaforge/api-contract";

// See src/lib/i18n/locales/en/api-errors.ts for what this local type covers.
type ClientFailureKind = "network" | "timeout" | "invalid-response";

export const viApiErrors = {
  "validation-failed": "Dữ liệu bạn nhập chưa hợp lệ. Hãy kiểm tra lại.",
  "password-too-common": "Mật khẩu này quá phổ biến. Hãy chọn mật khẩu khác.",
  unauthenticated: "Bạn cần đăng nhập để tiếp tục.",
  "invalid-credentials": "Email hoặc mật khẩu không đúng.",
  "session-expired": "Phiên đăng nhập đã hết. Hãy đăng nhập lại.",
  "origin-not-allowed": "Yêu cầu này không được phép. Hãy tải lại trang.",
  "schema-limit-reached": "Bạn đã đạt giới hạn số schema trên cloud.",
  "not-found": "Không tìm thấy.",
  "email-already-registered": "Email này đã có tài khoản.",
  "schema-id-unavailable": "Không thể lưu schema này. Hãy thử lại.",
  "revision-conflict": "Schema đã được sửa ở nơi khác.",
  "payload-too-large": "Schema này quá lớn để lưu lên cloud.",
  "document-invalid": "Dữ liệu schema không hợp lệ.",
  "too-many-requests": "Bạn thử quá nhiều lần. Hãy đợi một lúc rồi thử lại.",
  "internal-error": "Có lỗi xảy ra ở máy chủ. Hãy thử lại sau.",
  network: "Mất kết nối mạng.",
  timeout: "Yêu cầu đã hết thời gian chờ.",
  "invalid-response": "Máy chủ trả về dữ liệu không đọc được.",
} as const satisfies LocaleNamespace<typeof enApiErrors> &
  Record<ApiErrorCode | ClientFailureKind, string>;
