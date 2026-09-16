import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enEditorScreen } from "@/lib/i18n/locales/en/editor/screen";

export const viEditorScreen = {
  pageTitle: "Trình sửa schema – {{appName}}",
  notFound: {
    title: "Không tìm thấy schema",
    description:
      "Schema này không có trong trình duyệt này. Có thể nó đã bị xóa.",
  },
  locked: {
    title: "Schema này đang mở ở một tab khác",
    description: "Schema sẽ tự mở ở đây khi tab kia đóng hoặc rời schema.",
  },
  unsupportedVersion: {
    title: "Schema cần phiên bản mới hơn",
    description:
      "Schema này được lưu bằng phiên bản SchemaForge mới hơn. Hãy tải lại trang.",
  },
  unreadable: {
    title: "Dữ liệu schema bị hỏng",
    description: "Không đọc được schema đã lưu. Bản đã lưu được giữ nguyên.",
  },
  storageUnavailable: {
    title: "Không dùng được bộ nhớ trình duyệt",
    readFailed:
      "Không đọc được schema từ bộ nhớ trình duyệt. Hãy tải lại trang.",
  },
  crashTitle: "Đã có lỗi xảy ra",
  crashDescription:
    "Trình sửa đã dừng đột ngột. Thay đổi đã lưu gần nhất vẫn được giữ. Hãy tải lại để tiếp tục.",
  backToList: "Quay lại danh sách schema",
  loading: "Đang mở schema…",
} as const satisfies LocaleNamespace<typeof enEditorScreen>;
