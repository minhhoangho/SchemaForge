import type { JSX } from "react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * The toolbar and canvas placeholders shown while the editor opens. Visual
 * only: it mounts again at each opening step, so a status inside it would be
 * announced unreliably. `EditorScreenLoader` owns the one loading status.
 */
export function EditorSkeleton(): JSX.Element {
  return (
    <div aria-hidden className="flex h-dvh flex-col">
      <div className="flex h-12 items-center gap-2 border-b border-border px-2">
        <Skeleton className="h-8 w-40 motion-reduce:animate-none" />
        <Skeleton className="h-8 w-64 motion-reduce:animate-none" />
      </div>
      <Skeleton className="m-4 flex-1 motion-reduce:animate-none" />
    </div>
  );
}
