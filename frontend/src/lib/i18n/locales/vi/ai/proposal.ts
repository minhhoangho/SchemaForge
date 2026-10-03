import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAiProposal } from "@/lib/i18n/locales/en/ai/proposal";

// Vietnamese has a single plural form, so both plural keys read the same; the
// `_one` key is kept only so vi has exactly the keys of en.
export const viAiProposal = {
  title: "Thay đổi được đề xuất",
  accept: "Chấp nhận",
  discard: "Bỏ",
  accepted: "Đã chấp nhận",
  discarded: "Đã bỏ",
  stale: "Đề xuất không còn áp dụng được vì schema đã thay đổi.",
  invalid: "Đề xuất không hợp lệ nên không thể áp dụng.",
  stoppedEarly: "Trợ lý đã dừng trước khi hoàn tất đề xuất này.",
  retry: "Thử lại",
  counts: {
    addedTables_one: "{{count}} bảng mới",
    addedTables_other: "{{count}} bảng mới",
    addedColumns_one: "{{count}} cột mới",
    addedColumns_other: "{{count}} cột mới",
    changedTables_one: "{{count}} bảng được sửa",
    changedTables_other: "{{count}} bảng được sửa",
    changedColumns_one: "{{count}} cột được sửa",
    changedColumns_other: "{{count}} cột được sửa",
    removedTables_one: "{{count}} bảng bị xóa",
    removedTables_other: "{{count}} bảng bị xóa",
    removedColumns_one: "{{count}} cột bị xóa",
    removedColumns_other: "{{count}} cột bị xóa",
    cascadeRelations_one: "{{count}} quan hệ bị xóa kèm theo",
    cascadeRelations_other: "{{count}} quan hệ bị xóa kèm theo",
    retypedColumns_one: "{{count}} cột đổi kiểu",
    retypedColumns_other: "{{count}} cột đổi kiểu",
  },
  previewBar: {
    label: "Xem trước đề xuất",
    title: "Đang xem trước các thay đổi được đề xuất trên canvas",
  },
  confirmDelete: {
    title: "Xóa dữ liệu theo đề xuất này?",
    body: "Chấp nhận đề xuất này sẽ xóa {{tables}} và {{columns}}. Bạn có thể hoàn tác sau đó.",
    confirm: "Chấp nhận và xóa",
    cancel: "Hủy",
  },
} as const satisfies LocaleNamespace<typeof enAiProposal>;
