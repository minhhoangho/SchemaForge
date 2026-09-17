import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enEditorLayout } from "@/lib/i18n/locales/en/editor/editor-layout";

export const viEditorLayout = {
  skipToPanel: "Bỏ qua canvas",
  propertiesLabel: "Thuộc tính",
  canvasLabel: "Canvas schema",
  deleted: {
    one: "Đã xóa bảng {{name}}",
    // Vietnamese has one plural form, so i18next only reads `_other`; `_one`
    // keeps the key set equal to the English one.
    many_one: "Đã xóa {{count}} phần tử",
    many_other: "Đã xóa {{count}} phần tử",
  },
} as const satisfies LocaleNamespace<typeof enEditorLayout>;
