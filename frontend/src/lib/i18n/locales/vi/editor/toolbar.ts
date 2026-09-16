import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enEditorToolbar } from "@/lib/i18n/locales/en/editor/toolbar";

export const viEditorToolbar = {
  backToList: "Quay lại danh sách schema",
  schemaName: {
    label: "Tên schema",
    dialogTitle: "Đổi tên schema",
    submit: "Đổi tên",
  },
  addTable: "Thêm bảng",
  addEnum: "Thêm enum",
  undo: "Hoàn tác",
  redo: "Làm lại",
  zoomIn: "Phóng to",
  zoomOut: "Thu nhỏ",
  fitView: "Xem toàn bộ",
  issues: {
    // Vietnamese has one plural form, so i18next only reads `count_other`;
    // `count_one` exists to keep the key set equal to the English one.
    count_one: "{{count}} vấn đề",
    count_other: "{{count}} vấn đề",
    none: "Không có vấn đề",
  },
} as const satisfies LocaleNamespace<typeof enEditorToolbar>;
