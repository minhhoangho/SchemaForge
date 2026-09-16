import type { JSX } from "react";

import { EditorSkeleton } from "@/features/editor/components/editor-skeleton";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { getServerTranslation } from "@/lib/i18n/server-translation";

// Rendered on the server before the editor screen hydrates, so it carries its
// own status text; the placeholders themselves are visual only.
export default async function EditorLoading(): Promise<JSX.Element> {
  const locale = await getRequestLocale();
  const t = getServerTranslation(locale, "editor");

  return (
    <>
      <p role="status" className="sr-only">
        {t("screen.loading")}
      </p>
      <EditorSkeleton />
    </>
  );
}
