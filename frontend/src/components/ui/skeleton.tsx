import type * as React from "react";
import type { JSX } from "react";

import { cn } from "@/lib/class-names";

function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">): JSX.Element {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

export { Skeleton };
