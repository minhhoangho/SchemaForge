"use client";

import { XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/class-names";
import { logger } from "@/lib/logger";

import { useIsNarrowViewport } from "../../hooks/use-is-narrow-viewport";
import type { AiWindowState } from "../../state/create-editor-store";
import { useEditorStore } from "../../state/use-editor-store";
// Type only: the panel itself is the lazy chunk below.
import type { AiPanelProps } from "./ai-panel";
import { AI_LAUNCHER_ID } from "./ai-panel-ids";

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

function PanelLoading(): JSX.Element {
  const { t } = useTranslation("ai");

  return (
    <div className="size-full">
      <Skeleton aria-hidden className="size-full rounded-none" />
      <p role="status" className="sr-only">
        {t("panel.loading")}
      </p>
    </div>
  );
}

// A chunk that fails to load (offline, a new deploy) leaves the rest of the
// editor working and says why the panel is missing. The close button matters
// on a narrow screen, where the window covers the launcher.
function PanelLoadFailed({ id }: AiPanelProps): JSX.Element {
  const { t } = useTranslation("ai");
  const closeAiWindow = useEditorStore((state) => state.closeAiWindow);

  return (
    <section
      id={id}
      role="dialog"
      aria-modal="false"
      aria-label={t("panel.title")}
      className="flex items-start gap-2 p-3 text-sm"
    >
      <p role="alert" className="mr-auto">
        {t("panel.loadFailed")}
      </p>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("panel.close")}
        onClick={() => {
          closeAiWindow();
          document.getElementById(AI_LAUNCHER_ID)?.focus();
        }}
      >
        <XIcon aria-hidden />
      </Button>
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
// the AI window or a preview first appears, so opening the editor loads none
// of them (AI spec section 15).
const AiPanelLoader = dynamic<AiPanelProps>(
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

type FrameLayout = Pick<AiWindowState, "isMinimized" | "isExpanded"> & {
  readonly isNarrow: boolean;
};

// Above the launcher (bottom 1rem + 3.5rem + 1rem gap), at most the canvas
// height minus that and a 1rem top gap. Below 640px: a full-screen sheet, or
// a bar at the bottom while minimized.
function getFrameClassName({
  isMinimized,
  isExpanded,
  isNarrow,
}: FrameLayout): string {
  return cn(
    "flex flex-col overflow-hidden bg-background text-foreground",
    "origin-bottom-right duration-150 motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
    isNarrow
      ? "fixed inset-0 z-50"
      : "absolute right-4 bottom-[5.5rem] z-20 rounded-2xl border border-border shadow-lg",
    !isNarrow &&
      (isExpanded
        ? "h-[calc(100%-6.5rem)] w-[min(520px,calc(100%-2rem))]"
        : "h-[min(640px,calc(100%-6.5rem))] w-[min(380px,calc(100%-2rem))]"),
    isMinimized && "h-auto",
    isMinimized && isNarrow && "top-auto border-t border-border",
  );
}

// No exit animation to wait for: reduced motion, or no styles (tests).
function hasRunningAnimation(element: HTMLElement): boolean {
  const { animationName } = window.getComputedStyle(element);
  return animationName !== "" && animationName !== "none";
}

/**
 * The floating AI window over the canvas (AI-R1, AI-R51). It stays mounted
 * through its closing animation, inert, and only then unmounts; the
 * conversation lives in the store above it, so closing keeps it.
 */
export function AiWindow({ id }: { readonly id: string }): JSX.Element | null {
  const isOpen = useEditorStore((state) => state.aiWindow.isOpen);
  const isMinimized = useEditorStore((state) => state.aiWindow.isMinimized);
  const isExpanded = useEditorStore((state) => state.aiWindow.isExpanded);
  const isNarrow = useIsNarrowViewport();
  const [isMounted, setIsMounted] = useState(isOpen);
  if (isOpen && !isMounted) {
    setIsMounted(true);
  }
  const frameRef = useRef<HTMLDivElement>(null);
  const isClosing = isMounted && !isOpen;

  useEffect(() => {
    const frame = frameRef.current;
    if (isClosing && (frame === null || !hasRunningAnimation(frame))) {
      setIsMounted(false);
    }
  }, [isClosing]);

  if (!isMounted) {
    return null;
  }
  return (
    <div
      ref={frameRef}
      data-state={isOpen ? "open" : "closed"}
      inert={isClosing}
      className={getFrameClassName({ isMinimized, isExpanded, isNarrow })}
      onAnimationEnd={(event) => {
        // Animations inside the window (a skeleton, a caret) bubble here.
        if (isClosing && event.target === event.currentTarget) {
          setIsMounted(false);
        }
      }}
    >
      <AiPanelLoader id={id} isNarrow={isNarrow} />
    </div>
  );
}
