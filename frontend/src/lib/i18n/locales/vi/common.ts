import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enCommon } from "@/lib/i18n/locales/en/common";

export const viCommon = {
  actions: {
    cancel: "Hủy",
    close: "Đóng",
    confirm: "Xác nhận",
    create: "Tạo",
    delete: "Xóa",
    open: "Mở",
    rename: "Đổi tên",
    retry: "Thử lại",
    undo: "Hoàn tác",
    reload: "Tải lại",
  },
  theme: {
    label: "Giao diện",
    system: "Theo hệ thống",
    light: "Sáng",
    dark: "Tối",
  },
  language: {
    label: "Ngôn ngữ",
    shortName: "VI",
    vi: "Tiếng Việt",
    en: "English",
  },
  saveStatus: {
    saving: "Đang lưu…",
    saved: "Đã lưu",
    failed: "Chưa lưu được",
  },
  notifications: {
    label: "Thông báo",
  },
} as const satisfies LocaleNamespace<typeof enCommon>;
