"use client";

import { CloudIcon } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { buildAuthHref } from "@/lib/auth/sanitize-return-to";

const LIST_PATH = "/";

export function SignInInvite(): JSX.Element {
  const { t } = useTranslation("sync");

  return (
    <p className="col-span-2 flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <CloudIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <Link
        href={buildAuthHref("/sign-in", LIST_PATH)}
        className="font-medium text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("schemaList.signInToSave")}
      </Link>
    </p>
  );
}
