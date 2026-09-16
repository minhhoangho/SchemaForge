import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enEditorLeftPanel } from "@/lib/i18n/locales/en/editor/left-panel";

export const viEditorLeftPanel = {
  label: "Tổng quan schema",
  collapse: "Thu gọn tổng quan schema",
  expand: "Mở rộng tổng quan schema",
  tabs: {
    tables: "Bảng",
    enums: "Enum",
    // Vietnamese has one plural form, so i18next only reads `_other`; `_one`
    // keeps the key set equal to the English one.
    issues_one: "Vấn đề ({{count}})",
    issues_other: "Vấn đề ({{count}})",
  },
  tables: {
    columnCount_one: "{{count}} cột",
    columnCount_other: "{{count}} cột",
    issueCount_one: "{{count}} vấn đề",
    issueCount_other: "{{count}} vấn đề",
    empty: "Chưa có bảng nào.",
  },
  enums: {
    nameLabel: "Tên enum",
    valueLabel: "Giá trị {{position}}",
    addValue: "Thêm giá trị",
    moveValueUp: "Đưa giá trị {{position}} ({{value}}) lên",
    moveValueDown: "Đưa giá trị {{position}} ({{value}}) xuống",
    removeValue: "Xóa giá trị {{position}} ({{value}})",
    emptyValue: "trống",
    remove: "Xóa enum",
    inUse: "Đang được các cột sau dùng nên không xóa được:",
    empty: "Chưa có enum nào.",
  },
  issues: {
    none: "Không có vấn đề nào",
    goTo: "Đi tới:",
  },
} as const satisfies LocaleNamespace<typeof enEditorLeftPanel>;
