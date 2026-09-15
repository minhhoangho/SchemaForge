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
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
