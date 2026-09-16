import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enStorage } from "@/lib/i18n/locales/en/storage";
import type { StorageErrorCode } from "@/lib/storage/storage-error";

export const viStorage = {
  "quota-exceeded":
    "Bộ nhớ trình duyệt đã đầy. Hãy xóa bớt schema rồi thử lại.",
  unavailable:
    "Trình duyệt không cho dùng bộ nhớ local, ví dụ khi đang ở chế độ riêng tư.",
  "outdated-tab": "SchemaForge đã được cập nhật ở tab khác. Hãy tải lại trang.",
  closed: "Kết nối bộ nhớ đã đóng. Hãy tải lại trang.",
  unknown: "Không lưu được. Hãy thử lại.",
} as const satisfies LocaleNamespace<typeof enStorage> &
  Record<StorageErrorCode, string>;
