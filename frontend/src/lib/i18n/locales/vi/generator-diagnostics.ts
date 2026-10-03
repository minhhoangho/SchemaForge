import type { GeneratorDiagnosticCode } from "@schemaforge/core";

export const viGeneratorDiagnostics = {
  "enum-not-supported":
    "Cột “{{column}}” của “{{table}}” dùng enum mà đầu ra này không biểu diễn được. Cột được ghi dạng văn bản nên các giá trị không còn bị ràng buộc.",
  "type-not-supported":
    "Cột “{{column}}” của “{{table}}” có kiểu mà đầu ra này không hỗ trợ. Cột được ghi dạng văn bản.",
  "type-parameter-out-of-range":
    "Kiểu của cột “{{column}}” của “{{table}}” vượt giới hạn của đầu ra này nên đã được điều chỉnh cho vừa.",
  "key-column-type-narrowed":
    "Kiểu của cột “{{column}}” của “{{table}}” đã được thu hẹp vì cột thuộc một khóa hoặc index và đầu ra này giới hạn độ dài khóa.",
  "key-column-type-not-indexable":
    "Trong bảng “{{table}}”, một khóa, ràng buộc unique, index hoặc quan hệ đã bị bỏ vì đầu ra này không đánh index được các cột của nó.",
  "referential-action-not-supported":
    "Quan hệ từ “{{table}}” dùng một hành động mà đầu ra này không hỗ trợ. Hành động được ghi là NO ACTION.",
  "referential-action-cycle":
    "Quan hệ từ “{{table}}” sẽ tạo vòng cascade hoặc đường cascade thứ hai. Các hành động được ghi là NO ACTION.",
  "unique-nulls-restricted":
    "Trong bảng “{{table}}”, ràng buộc unique trên cột cho phép null chỉ cho một dòng NULL ở đầu ra này.",
  "table-without-identifier":
    "Bảng “{{table}}” không có khóa chính hay cột unique bắt buộc, nên đầu ra này chỉ bao phủ một phần những gì bảng mô tả.",
  "custom-type-unmapped":
    "Cột “{{column}}” của “{{table}}” có kiểu tùy chỉnh mà đầu ra này không ánh xạ được. Cột được ghi với kiểu không xác định.",
  "custom-type-unsafe":
    "Kiểu tùy chỉnh của cột “{{column}}” của “{{table}}” không phải tên kiểu an toàn. Cột được ghi dạng văn bản.",
  "default-omitted":
    "Giá trị mặc định của cột “{{column}}” của “{{table}}” không hợp với kiểu cột nên đã bị bỏ.",
  "identifier-collision-renamed":
    "Trong bảng “{{table}}”, một cột hoặc index đã được thêm hậu tố số vì tên trùng với một tên khác ở đầu ra này.",
  "null-character-removed":
    "Ký tự null đã bị bỏ khỏi một ghi chú, giá trị mặc định hoặc giá trị enum vì đầu ra này không lưu được ký tự đó.",
  "comment-truncated":
    "Một ghi chú của bảng “{{table}}” hoặc của một cột trong bảng đã bị cắt về độ dài đầu ra này cho phép.",
  "seed-table-skipped":
    "Bảng “{{table}}” không có dòng nào vì một cột bắt buộc không sinh được giá trị.",
  "seed-rows-reduced":
    "Bảng “{{table}}” có ít dòng hơn yêu cầu vì ràng buộc unique không đủ giá trị khác nhau.",
} as const satisfies Record<GeneratorDiagnosticCode, string>;
