import type { ImportDiagnosticCode } from "@schemaforge/core";

// Tên phần tử có cột riêng trong bước xem trước nên không thông báo nào nêu tên.
export const viImportDiagnostics = {
  "source-too-large": "Nguồn quá lớn để import.",
  "too-many-elements": "Nguồn mô tả quá nhiều phần tử để import.",
  "parse-failed": "Không đọc được nguồn.",
  "syntax-error": "Nguồn có lỗi cú pháp ở đây.",
  "reference-not-found":
    "Một tham chiếu trỏ tới thứ không tồn tại nên phần tử chứa tham chiếu đã bị bỏ.",
  "table-renamed": "Bảng đã được đổi tên vì tên trùng với một bảng có sẵn.",
  "enum-renamed": "Enum đã được đổi tên vì tên trùng với một enum có sẵn.",
  "index-renamed": "Index đã được đổi tên vì tên trùng với một index có sẵn.",
  "subject-area-renamed":
    "Subject area đã được đổi tên vì tên trùng với một subject area có sẵn.",
  "data-statements-ignored":
    "Các câu lệnh chèn dữ liệu đã bị bỏ qua. Chỉ cấu trúc được import.",
  "view-not-supported": "View chưa được hỗ trợ nên đã bị bỏ qua.",
  "routine-not-supported":
    "Function và procedure chưa được hỗ trợ nên đã bị bỏ qua.",
  "trigger-not-supported": "Trigger chưa được hỗ trợ nên đã bị bỏ qua.",
  "sequence-not-supported": "Sequence chưa được hỗ trợ nên đã bị bỏ qua.",
  "statement-not-supported": "Câu lệnh này chưa được hỗ trợ nên đã bị bỏ qua.",
  "namespace-dropped":
    "Schema hoặc namespace của bảng đã bị bỏ vì bảng trong SchemaForge không có namespace.",
  "index-expression-not-supported":
    "Index trên biểu thức chưa được hỗ trợ nên index đã bị bỏ.",
  "index-type-dropped":
    "Loại index đã bị bỏ vì SchemaForge không lưu thông tin này.",
  "check-converted-to-enum":
    "Ràng buộc CHECK liệt kê các giá trị cho phép đã được chuyển thành enum.",
  "check-constraint-not-supported":
    "Ràng buộc CHECK chưa được hỗ trợ nên đã bị bỏ qua.",
  "computed-column-not-supported":
    "Biểu thức của cột tính toán chưa được hỗ trợ nên đã bị bỏ.",
  "type-approximated":
    "Kiểu của cột không có kiểu tương ứng chính xác nên được thay bằng kiểu gần nhất.",
  "type-parameter-dropped":
    "Một tham số của kiểu cột, như độ dài hoặc độ chính xác, đã bị bỏ.",
  "identity-options-dropped":
    "Giá trị bắt đầu và bước tăng của cột identity đã bị bỏ.",
  "type-not-supported":
    "Kiểu của cột chưa được hỗ trợ. Cột được import với kiểu tùy chỉnh.",
  "default-approximated":
    "Giá trị mặc định đã được thay bằng giá trị gần nhất mà SchemaForge hỗ trợ.",
  "sequence-default-as-auto-increment":
    "Giá trị mặc định lấy từ sequence đã được chuyển thành tự tăng.",
  "default-not-supported": "Giá trị mặc định chưa được hỗ trợ nên đã bị bỏ.",
  "on-update-not-supported":
    "Mệnh đề ON UPDATE của cột chưa được hỗ trợ nên đã bị bỏ.",
  "provider-not-supported":
    "Provider của datasource chưa được hỗ trợ hoặc không có datasource.",
  "composite-type-not-supported":
    "Composite type chưa được hỗ trợ nên đã bị bỏ qua.",
  "scalar-list-as-custom":
    "Cột dạng danh sách đã được import với kiểu tùy chỉnh.",
  "index-option-dropped":
    "Một tùy chọn của index hoặc khóa đã bị bỏ vì SchemaForge không lưu thông tin này.",
  "updated-at-not-supported":
    "Thuộc tính @updatedAt chưa được hỗ trợ nên đã bị bỏ.",
  "comment-dropped": "Một ghi chú đã bị bỏ vì không có chỗ lưu ở đây.",
  "color-dropped": "Một màu đã bị bỏ vì không có chỗ lưu ở đây.",
  "back-relation-missing":
    "Quan hệ không có trường tương ứng ở model kia nên chỉ được dựng từ phía này.",
  "implicit-many-to-many-not-supported":
    "Quan hệ nhiều-nhiều ngầm định chưa được hỗ trợ nên đã bị bỏ qua.",
  "many-to-many-not-supported":
    "Quan hệ nhiều-nhiều chưa được hỗ trợ nên đã bị bỏ qua.",
} as const satisfies Record<ImportDiagnosticCode, string>;
