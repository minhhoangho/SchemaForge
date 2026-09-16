import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enEditorRelationPanel } from "@/lib/i18n/locales/en/editor/relation-panel";

export const viEditorRelationPanel = {
  label: "Quan hệ",
  kindLabel: "Loại quan hệ",
  kind: {
    oneToOne: "Một–một",
    oneToMany: "Một–nhiều",
  },
  kindHint: "Quan hệ nhiều–nhiều được tạo bằng bảng trung gian.",
  fromTable: "Bảng nguồn",
  toTable: "Bảng đích",
  changeTablesHint:
    "Muốn nối các bảng khác thì xóa quan hệ này rồi tạo quan hệ mới.",
  columnPairs: {
    title: "Cặp cột",
    fromHeader: "Cột nguồn",
    toHeader: "Cột đích",
    fromLabel: "Cột nguồn, cặp {{number}}",
    toLabel: "Cột đích, cặp {{number}}",
    add: "Thêm cặp cột",
    remove: "Bỏ cặp cột {{number}}",
    lastPair: "Quan hệ luôn phải còn ít nhất một cặp cột.",
  },
  onDelete: "Khi xóa",
  onUpdate: "Khi cập nhật",
  actions: {
    noAction: "NO ACTION",
    restrict: "RESTRICT (chặn)",
    cascade: "CASCADE (lan theo)",
    setNull: "SET NULL",
    setDefault: "SET DEFAULT",
  },
  remove: "Xóa quan hệ",
  multiSelection: {
    label: "Nhiều phần tử",
    // Vietnamese has one plural form, so i18next only reads `_other`; `_one`
    // exists to keep the key set equal to the English one.
    tableCount_one: "{{count}} bảng",
    tableCount_other: "{{count}} bảng",
    relationCount_one: "{{count}} quan hệ",
    relationCount_other: "{{count}} quan hệ",
    summary: "Đã chọn {{tables}}, {{relations}}",
    deleteAll: "Xóa tất cả",
  },
} as const satisfies LocaleNamespace<typeof enEditorRelationPanel>;
