import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enCanvas } from "@/lib/i18n/locales/en/canvas";

// Vietnamese has a single plural form, so both plural keys read the same; the
// `_one` key is kept only so vi has exactly the keys of en.
export const viCanvas = {
  node: {
    label_one: "Bảng {{name}}, {{count}} cột",
    label_other: "Bảng {{name}}, {{count}} cột",
    issueCount_one: "{{count}} vấn đề",
    issueCount_other: "{{count}} vấn đề",
    comment: "Ghi chú: {{comment}}",
  },
  column: {
    primaryKey: "Khóa chính",
    primaryKeyPosition: "Khóa chính, vị trí {{position}}",
    foreignKey: "Khóa ngoại",
    unique: "Duy nhất",
    nullable: "Cho phép NULL",
    autoIncrement: "Tự tăng",
    issue_one: "{{count}} vấn đề",
    issue_other: "{{count}} vấn đề",
  },
  edge: {
    label: "{{fromTable}}.{{fromColumn}} → {{toTable}}.{{toColumn}}, {{kind}}",
    kindOneToOne: "một–một",
    kindOneToMany: "một–nhiều",
    oneToOne: "1-1",
    oneToMany: "1-n",
    columnCount_one: "{{count}} cột",
    columnCount_other: "{{count}} cột",
    hasIssues: "có vấn đề",
  },
  empty: {
    title: "Schema này chưa có bảng nào",
    addTable: "Thêm bảng",
  },
  minimap: {
    label: "Bản đồ thu nhỏ",
  },
  handle: {
    label: "Điểm nối",
  },
  a11y: {
    nodeDescription:
      "Nhấn Enter hoặc Space để chọn bảng. Sau đó dùng phím mũi tên để di chuyển bảng.",
    nodeKeyboardDisabled:
      "Nhấn Enter hoặc Space để chọn bảng. Di chuyển bằng bàn phím đang bị tắt.",
    nodeMoved: "Đã di chuyển {{direction}}, tới x {{x}}, y {{y}}",
    edgeDescription: "Nhấn Enter hoặc Space để chọn quan hệ.",
    directions: {
      up: "lên trên",
      down: "xuống dưới",
      left: "sang trái",
      right: "sang phải",
    },
  },
} as const satisfies LocaleNamespace<typeof enCanvas>;
