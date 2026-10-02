"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { BrandMark } from "@/components/brand-mark";

// The page reads its locale from the I18nProvider in the root layout, so it
// never calls a request API itself.
export default function NotFound(): JSX.Element {
  const { t } = useTranslation("common");

  return (
    <main className="grid min-h-dvh content-start justify-items-center gap-6 bg-canvas bg-[radial-gradient(var(--canvas-dot)_1px,transparent_1px)] bg-size-[20px_20px] p-4 sm:place-content-center sm:p-6">
      <BrandMark />
      <div className="flex w-full max-w-[400px] flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-md sm:p-8">
        <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
        <p className="text-muted-foreground">{t("notFound.description")}</p>
        <Link
          href="/"
          className="self-start text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("notFound.backToList")}
        </Link>
      </div>
    </main>
  );
}
