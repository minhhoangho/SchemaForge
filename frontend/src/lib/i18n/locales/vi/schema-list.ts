import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSchemaList } from "@/lib/i18n/locales/en/schema-list";

export const viSchemaList = {
  pageTitle: "Schema của bạn – {{appName}}",
  title: "Schema của bạn",
  loading: "Đang tải danh sách schema…",
  create: {
    trigger: "Tạo schema",
    dialogTitle: "Tạo schema",
    description: "Đặt tên cho schema mới. Bạn có thể đổi tên sau.",
    nameLabel: "Tên",
    submit: "Tạo",
  },
  rename: {
    dialogTitle: "Đổi tên schema",
    description: "Nhập tên mới cho “{{name}}”.",
    nameLabel: "Tên",
    submit: "Đổi tên",
  },
  delete: {
    title: "Xóa “{{name}}”?",
    unreadableTitle: "Xóa schema không đọc được này?",
    description:
      "Schema sẽ bị xóa hẳn khỏi trình duyệt này. Thao tác này không hoàn tác được.",
    confirm: "Xóa",
  },
  empty: {
    title: "Chưa có schema nào",
    createFirst: "Tạo schema đầu tiên",
  },
  row: {
    actions: "Thao tác cho {{name}}",
    open: "Mở",
    rename: "Đổi tên",
    delete: "Xóa",
    unreadable: "Schema không đọc được",
    updatedAt: "Cập nhật lúc {{time}}",
  },
  nameRequired: "Hãy nhập tên.",
  openInAnotherTab: "Schema này đang mở ở một tab khác.",
  unreadableCannotRename: "Schema này không đọc được nên không đổi tên được.",
} as const satisfies LocaleNamespace<typeof enSchemaList>;
