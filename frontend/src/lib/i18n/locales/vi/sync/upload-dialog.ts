import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSyncUploadDialog } from "@/lib/i18n/locales/en/sync/upload-dialog";

export const viSyncUploadDialog = {
  title: "Lưu các schema trên trình duyệt này vào tài khoản?",
  description:
    "Schema không chọn vẫn nằm trên trình duyệt này và lưu lên sau được.",
  listLabel: "Schema cần lưu",
  submit: "Lưu lên cloud",
  later: "Để sau",
  uploaded_one: "Đã lưu {{count}} schema lên cloud",
  uploaded_other: "Đã lưu {{count}} schema lên cloud",
  notUploaded_one: "{{count}} schema chưa lưu được",
  notUploaded_other: "{{count}} schema chưa lưu được",
} as const satisfies LocaleNamespace<typeof enSyncUploadDialog>;
