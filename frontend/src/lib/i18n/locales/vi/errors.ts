import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enErrors } from "@/lib/i18n/locales/en/errors";

export const viErrors = {
  codes: {
    "invalid-shape": "Dữ liệu đã lưu không đúng cấu trúc mong đợi.",
    "version-unsupported":
      "Schema này được lưu bằng một phiên bản SchemaForge mới hơn.",
    "id-mismatch":
      "Dữ liệu đã lưu không nhất quán: một phần tử mang định danh sai.",
    "table-not-found": "Không tìm thấy bảng cần thay đổi.",
    "column-not-found": "Không tìm thấy cột cần thay đổi.",
    "relation-not-found": "Không tìm thấy quan hệ cần thay đổi.",
    "index-not-found": "Không tìm thấy index cần thay đổi.",
    "enum-not-found": "Không tìm thấy enum cần thay đổi.",
    "subject-area-not-found": "Không tìm thấy vùng chủ đề cần thay đổi.",
    "note-not-found": "Không tìm thấy ghi chú cần thay đổi.",
    "column-not-in-table": "Cột đó thuộc về một bảng khác.",
    "column-listed-twice": "Cùng một cột bị liệt kê hai lần.",
    "column-ownership-mismatch":
      "Dữ liệu đã lưu không nhất quán: một cột thuộc về bảng không liệt kê nó.",
    "id-already-exists": "Đã có một phần tử mang cùng định danh.",
    "enum-in-use": "Enum này vẫn đang được ít nhất một cột dùng.",
    "insert-position-out-of-range": "Vị trí được chọn nằm ngoài danh sách.",
    "primary-key-missing":
      "Bảng cần có khóa chính trước khi dùng được trong một quan hệ.",
  },
  operationNotApplied: "Thao tác không được áp dụng",
} as const satisfies LocaleNamespace<typeof enErrors>;
