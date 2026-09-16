"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

type EditorErrorProps = {
  readonly error: Error;
  readonly reset: () => void;
};

/**
 * Shown when the editor throws. The error message may carry schema content,
 * so it is neither shown nor logged; only its name is logged. The stored
 * schema is the last state that was saved successfully.
 */
export default function EditorError({
  error,
  reset,
}: EditorErrorProps): JSX.Element {
  const { t } = useTranslation(["editor", "common"]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    logger.error("editor.crashed", { errorName: error.name });
  }, [error]);

  // The crashed editor took the focused element with it; the heading takes
  // focus so screen readers announce the crash.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="mx-auto flex max-w-prose flex-col gap-4 p-6">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("screen.crashTitle")}
      </h1>
      <p className="text-muted-foreground">{t("screen.crashDescription")}</p>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          onClick={() => {
            reset();
          }}
        >
          {t("common:actions.reload")}
        </Button>
        <Link
          href="/"
          className="text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("screen.backToList")}
        </Link>
      </div>
    </main>
  );
}
