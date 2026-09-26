"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { buildAuthHref } from "@/lib/auth/sanitize-return-to";

const LIST_PATH = "/";

export function SessionExpiredBanner(): JSX.Element {
  const { t } = useTranslation("sync");

  return (
    <div
      role="status"
      className="col-span-2 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted p-3"
    >
      <p className="min-w-0 flex-1 font-medium">
        {t("schemaList.sessionExpiredBanner")}
      </p>
      <Button asChild variant="outline">
        <Link href={buildAuthHref("/sign-in", LIST_PATH)}>
          {t("schemaList.signInAgain")}
        </Link>
      </Button>
    </div>
  );
}
