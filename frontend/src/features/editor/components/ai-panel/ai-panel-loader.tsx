"use client";

import dynamic from "next/dynamic";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

function PanelLoading(): JSX.Element {
  const { t } = useTranslation("ai");

  return (
    <div className="h-full w-80 shrink-0 border-l border-border">
      <Skeleton aria-hidden className="size-full rounded-none" />
      <p role="status" className="sr-only">
        {t("panel.loading")}
      </p>
    </div>
  );
}

// A chunk that fails to load (offline, a new deploy) leaves the rest of the
// editor working and says why the panel is missing.
function PanelLoadFailed({ id }: { readonly id: string }): JSX.Element {
  const { t } = useTranslation("ai");

  return (
    <section
      id={id}
      tabIndex={-1}
      aria-label={t("panel.title")}
      className="h-full w-80 shrink-0 border-l border-border p-3 text-sm outline-none"
    >
      <p role="alert">{t("panel.loadFailed")}</p>
    </section>
  );
}

function BarLoadFailed(): JSX.Element {
  const { t } = useTranslation("ai");

  return (
    <p
      role="alert"
      className="flex-none border-b border-border px-3 py-2 text-sm"
    >
      {t("panel.loadFailed")}
    </p>
  );
}

async function loadPreviewBar(): Promise<() => JSX.Element | null> {
  try {
    const { ProposalPreviewBar } = await import("./proposal-preview-bar");
    return ProposalPreviewBar;
  } catch (error: unknown) {
    logger.error("ai.preview-bar-load-failed", {
      errorName: getErrorName(error),
    });
    return BarLoadFailed;
  }
}

// The panel, the cards and (on the first send) the stream client load when
// the AI panel or a preview first appears, so opening the editor loads none
// of them (AI spec section 15). The placeholder keeps the panel's width.
export const AiPanelLoader = dynamic(
  async () => {
    // A turn in the panel is what starts a preview, so the bar's chunk is
    // fetched alongside; its own loader reports a failure if it is needed.
    void loadPreviewBar();
    try {
      const { AiPanel } = await import("./ai-panel");
      return AiPanel;
    } catch (error: unknown) {
      logger.error("ai.panel-load-failed", { errorName: getErrorName(error) });
      return PanelLoadFailed;
    }
  },
  { ssr: false, loading: PanelLoading },
);

export const ProposalPreviewBarLoader = dynamic(loadPreviewBar, {
  ssr: false,
  // The bar's height, so the canvas does not jump twice.
  loading: () => (
    <div aria-hidden className="h-12 flex-none border-b border-border" />
  ),
});
