import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAiSampleData } from "@/lib/i18n/locales/en/ai/sample-data";

// Vietnamese has a single plural form, so both plural keys read the same; the
// `_one` key is kept only so vi has exactly the keys of en.
export const viAiSampleData = {
  title: "Dữ liệu mẫu",
  caption: "Các dòng mẫu của bảng {{table}}",
  format: "Định dạng",
  formats: {
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    sqlserver: "SQL Server",
    json: "JSON",
  },
  copy: "Sao chép",
  copied: "Đã sao chép vào clipboard",
  copyFailed: "Không thể sao chép vào clipboard",
  download: "Tải xuống",
  outdated: "Schema đã thay đổi sau khi dữ liệu này được sinh. Hãy sinh lại.",
  retry: "Sinh lại",
  rowCount_one: "{{count}} dòng",
  rowCount_other: "{{count}} dòng",
  sqlReminder:
    "Dữ liệu này do AI sinh. Hãy đọc lại SQL trước khi chạy trên database.",
} as const satisfies LocaleNamespace<typeof enAiSampleData>;
