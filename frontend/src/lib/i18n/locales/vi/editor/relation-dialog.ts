import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enEditorRelationDialog } from "@/lib/i18n/locales/en/editor/relation-dialog";

export const viEditorRelationDialog = {
  title: "Tạo quan hệ",
  description: "Bảng chứa khóa ngoại tham chiếu tới bảng được tham chiếu.",
  enterHint: "Nhấn Enter để tạo quan hệ.",
  fromTable: "Bảng chứa khóa ngoại",
  toTable: "Bảng được tham chiếu",
  swap: "Đổi chiều",
  kindLabel: "Loại quan hệ",
  kind: {
    oneToMany: "Một–nhiều",
    oneToOne: "Một–một",
    manyToMany: "Nhiều–nhiều",
  },
  referencedColumns: "Cột được tham chiếu",
  referencedColumnLabel: "Cột được tham chiếu {{number}}",
  foreignKeyMode: {
    label: "Khóa ngoại",
    newColumns: "Tạo cột mới",
    existingColumns: "Dùng cột có sẵn",
  },
  columnPairs: {
    title: "Cột khóa ngoại",
    fromLabel: "Cột khóa ngoại {{number}}",
    toLabel: "tham chiếu {{column}}",
    placeholder: "Chọn một cột",
  },
  junctionTableName: "Tên bảng trung gian",
  submit: "Tạo quan hệ",
  errors: {
    primaryKeyMissing:
      "Bảng được tham chiếu chưa có khóa chính. Hãy thêm khóa chính, hoặc thả vào một cột.",
    primaryKeyMissingManyToMany:
      "Quan hệ nhiều–nhiều cần cả hai bảng đều có khóa chính.",
    unmatchedColumn: "Hãy chọn cột khóa ngoại cho mọi cột được tham chiếu.",
    duplicateColumn: "Có cột được chọn nhiều lần.",
  },
} as const satisfies LocaleNamespace<typeof enEditorRelationDialog>;
