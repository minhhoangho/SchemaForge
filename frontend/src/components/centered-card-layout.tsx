import type { JSX, ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/class-names";

type CenteredCardLayoutProps = {
  readonly gap?: "4" | "6";
  readonly children: ReactNode;
};

/** The dotted canvas backdrop with the brand mark and one card (auth, 404). */
export function CenteredCardLayout({
  gap = "6",
  children,
}: CenteredCardLayoutProps): JSX.Element {
  return (
    <main className="grid min-h-dvh content-start justify-items-center gap-6 bg-canvas bg-[radial-gradient(var(--canvas-dot)_1px,transparent_1px)] bg-size-[20px_20px] p-4 sm:place-content-center sm:p-6">
      <BrandMark />
      <div
        className={cn(
          "flex w-full max-w-[400px] flex-col rounded-xl border border-border bg-card p-6 shadow-md sm:p-8",
          gap === "6" ? "gap-6" : "gap-4",
        )}
      >
        {children}
      </div>
    </main>
  );
}
