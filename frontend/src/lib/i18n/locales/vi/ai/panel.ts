import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAiPanel } from "@/lib/i18n/locales/en/ai/panel";

export const viAiPanel = {
  title: "Trợ lý AI",
  toggle: "Trợ lý AI",
  close: "Đóng trợ lý AI",
  unreadReply: "Trợ lý AI, có phản hồi mới",
  minimize: "Thu nhỏ",
  restore: "Khôi phục",
  expand: "Mở rộng cửa sổ",
  shrink: "Thu gọn cửa sổ",
  newConversation: "Cuộc trò chuyện mới",
  dataNotice:
    "Tin nhắn và schema này được gửi tới Google Gemini để tạo câu trả lời. SchemaForge không lưu cuộc trò chuyện.",
  guestTitle: "Đăng nhập để dùng trợ lý AI",
  guestBody:
    "Trợ lý AI chỉ dành cho người dùng đã đăng nhập. Các schema của bạn vẫn dùng được khi không có tài khoản.",
  signInLink: "Đăng nhập",
  unavailable: "Trợ lý AI hiện không khả dụng.",
  messagesLabel: "Cuộc trò chuyện",
  userMessage: "Bạn",
  assistantMessage: "Trợ lý",
  loading: "Đang tải trợ lý AI",
  loadFailed: "Không tải được trợ lý AI. Hãy tải lại trang để thử lại.",
  emptyTitle: "Tôi có thể giúp gì cho schema này?",
  emptyBody: "Hãy yêu cầu một thay đổi hoặc chọn một thao tác nhanh.",
  consent: {
    title: "Trước khi bắt đầu",
    body: "Trợ lý gửi tin nhắn của bạn và schema hiện tại tới Google Gemini. Đừng đưa bí mật hoặc dữ liệu cá nhân vào đó.",
    termsLink: "Điều khoản dữ liệu của Gemini API",
    opensInNewTab: "(mở trong tab mới)",
    accept: "Đồng ý và tiếp tục",
  },
} as const satisfies LocaleNamespace<typeof enAiPanel>;
