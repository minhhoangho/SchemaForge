import type { Metadata } from "next";
import type { JSX } from "react";

import { EditorScreenLoader } from "@/features/editor/components/editor-screen-loader";
import { EditorStatusScreen } from "@/features/editor/components/editor-status-screen";
import { APP_NAME } from "@/lib/app-name";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { getServerTranslation } from "@/lib/i18n/server-translation";
import { isSchemaId } from "@/lib/storage/schema-id";

type EditorPageProps = {
  readonly params: Promise<{ readonly schemaId: string }>;
};

// The server cannot read IndexedDB, so the title never names the schema.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getServerTranslation(locale, "editor");

  return { title: t("screen.pageTitle", { appName: APP_NAME }) };
}

// The schema id comes from the URL and is untrusted, so its shape is checked
// before any storage query (spec section 1).
export default async function EditorPage({
  params,
}: EditorPageProps): Promise<JSX.Element> {
  const { schemaId } = await params;

  if (!isSchemaId(schemaId)) {
    return <EditorStatusScreen variant="not-found" />;
  }

  return <EditorScreenLoader schemaId={schemaId} />;
}
