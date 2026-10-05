"use client";

import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { AI_SMALL_TEXT_CLASS_NAME } from "./ai-text-styles";

export const GEMINI_API_TERMS_URL = "https://ai.google.dev/gemini-api/terms";

export function aiConsentKey(userId: string): string {
  return `schemaforge:ai-consent:${userId}`;
}

// Consent is per account and survives sign-out; a blocked localStorage just
// means asking again.
export function readAiConsent(userId: string): boolean {
  try {
    return localStorage.getItem(aiConsentKey(userId)) === "1";
  } catch {
    return false;
  }
}

export type AiConsentProps = {
  readonly userId: string;
  readonly onAccepted: () => void;
};

export function AiConsent({ userId, onAccepted }: AiConsentProps): JSX.Element {
  const { t } = useTranslation("ai");
  const titleId = useId();

  function accept(): void {
    try {
      localStorage.setItem(aiConsentKey(userId), "1");
    } catch {
      // Not remembered, but this opening of the panel continues.
    }
    onAccepted();
  }

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm"
    >
      <h3 id={titleId} className="text-sm font-semibold">
        {t("panel.consent.title")}
      </h3>
      <p className={AI_SMALL_TEXT_CLASS_NAME}>{t("panel.consent.body")}</p>
      <a
        href={GEMINI_API_TERMS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-6 items-center text-sm text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("panel.consent.termsLink")}
        <span className="sr-only">{t("panel.consent.opensInNewTab")}</span>
      </a>
      <div>
        <Button onClick={accept}>{t("panel.consent.accept")}</Button>
      </div>
    </section>
  );
}
