"use client";

import { Separator as SeparatorPrimitive } from "radix-ui";
import type * as React from "react";
import type { JSX } from "react";

import { cn } from "@/lib/class-names";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>): JSX.Element {
  // Radix names this boolean prop, so it is read from props instead of being
  // destructured into a variable that the boolean naming rule would reject.
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
      decorative={props.decorative ?? true}
    />
  );
}

export { Separator };
