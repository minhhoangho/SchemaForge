"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

// The page reads its locale from the I18nProvider in the root layout, so it
// never calls a request API itself.
export default function NotFound(): JSX.Element {
  const { t } = useTranslation("common");

  return (
    <main className="mx-auto flex max-w-prose flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-muted-foreground">{t("notFound.description")}</p>
      <Link
        href="/"
        className="self-start text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("notFound.backToList")}
      </Link>
    </main>
  );
}
