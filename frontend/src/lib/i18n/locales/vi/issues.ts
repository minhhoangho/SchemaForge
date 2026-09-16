import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enIssues } from "@/lib/i18n/locales/en/issues";

export const viIssues = {
  "name-empty": "Tên không được để trống.",
  "name-invalid":
    "Tên không được bắt đầu hay kết thúc bằng khoảng trắng và không được chứa ký tự điều khiển.",
  "name-too-long": "Tên quá dài: tên chỉ được tối đa 63 byte.",
  "table-name-duplicate":
    "Bảng “{{table}}” trùng tên với một bảng hoặc enum khác.",
  "enum-name-duplicate":
    "Enum “{{enum}}” trùng tên với một bảng hoặc enum khác.",
  "column-name-duplicate":
    "Bảng “{{table}}” đã có một cột khác tên “{{column}}”.",
  "index-name-duplicate": "Index “{{index}}” trùng tên với một index khác.",
  "subject-area-name-duplicate":
    "Vùng chủ đề này trùng tên với một vùng chủ đề khác.",
  "enum-values-empty": "Enum “{{enum}}” chưa có giá trị nào.",
  "enum-value-duplicate":
    "Enum “{{enum}}” có giá trị “{{value}}” lặp lại nhiều lần.",
  "column-type-invalid-scale":
    "Số chữ số thập phân của cột “{{column}}” không được lớn hơn tổng số chữ số.",
  "column-custom-type-invalid":
    "Kiểu tự đặt của cột “{{column}}” chỉ được dùng chữ cái, chữ số, gạch dưới, khoảng trắng, dấu phẩy và dấu ngoặc.",
  "column-default-invalid":
    "Giá trị mặc định của cột “{{column}}” không hợp lệ với kiểu của cột.",
  "column-default-incompatible":
    "Giá trị mặc định của cột “{{column}}” không dùng được với kiểu của cột.",
  "column-primary-key-nullable":
    "Cột “{{column}}” là khóa chính nên không được cho phép NULL.",
  "column-auto-increment-invalid-type":
    "Chỉ cột kiểu số nguyên mới tự tăng được, nên cột “{{column}}” thì không.",
  "column-auto-increment-nullable":
    "Cột tự tăng “{{column}}” không được cho phép NULL.",
  "column-auto-increment-with-default":
    "Cột tự tăng “{{column}}” không được có thêm giá trị mặc định.",
  "column-auto-increment-not-key":
    "Cột tự tăng “{{column}}” phải là khóa chính hoặc phải là duy nhất.",
  "table-multiple-auto-increment":
    "Bảng “{{table}}” chỉ được có một cột tự tăng.",
  "relation-column-type-mismatch":
    "Cột “{{column}}” khác kiểu với cột mà nó trỏ tới.",
  "relation-target-not-unique":
    "Quan hệ trỏ tới cột “{{column}}”, nhưng cột này không phải khóa chính và cũng không duy nhất.",
  "relation-one-to-one-not-unique":
    "Quan hệ một–một cần cột “{{column}}” là khóa chính hoặc duy nhất.",
  "relation-set-null-not-nullable":
    "Cột “{{column}}” phải cho phép NULL thì quan hệ mới đặt được cột về NULL.",
  "relation-set-default-without-default":
    "Cột “{{column}}” cần có giá trị mặc định thì quan hệ mới đặt được cột về giá trị đó.",
} as const satisfies LocaleNamespace<typeof enIssues>;
