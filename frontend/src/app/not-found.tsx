"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { CenteredCardLayout } from "@/components/centered-card-layout";

// The page reads its locale from the I18nProvider in the root layout, so it
// never calls a request API itself.
export default function NotFound(): JSX.Element {
  const { t } = useTranslation("common");

  return (
    <CenteredCardLayout gap="4">
      <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
      <p className="text-muted-foreground">{t("notFound.description")}</p>
      <Link
        href="/"
        className="inline-flex min-h-6 items-center self-start text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("notFound.backToList")}
      </Link>
    </CenteredCardLayout>
  );
}
