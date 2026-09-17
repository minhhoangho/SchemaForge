import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enSyncOpenSchema } from "@/lib/i18n/locales/en/sync/open-schema";

export const viSyncOpenSchema = {
  needsNetwork: {
    title: "Cần kết nối mạng để mở schema này",
  },
  retry: "Thử lại",
  deletedElsewhere: {
    title: "Schema đã bị xóa ở thiết bị khác",
  },
  notFoundSignIn: "Đăng nhập để xem schema này nếu nó đang nằm trên cloud",
} as const satisfies LocaleNamespace<typeof enSyncOpenSchema>;
