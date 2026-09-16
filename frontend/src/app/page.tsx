import type { Metadata } from "next";
import type { JSX } from "react";

import { SchemaListScreen } from "@/features/schema-list/components/schema-list-screen";
import { APP_NAME } from "@/lib/app-name";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { getServerTranslation } from "@/lib/i18n/server-translation";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getServerTranslation(locale, "schemaList");

  return { title: t("pageTitle", { appName: APP_NAME }) };
}

// The list lives in IndexedDB, which the server cannot read, so the server
// renders only the screen's shell and the list loads after hydration.
export default function HomePage(): JSX.Element {
  return <SchemaListScreen />;
}
