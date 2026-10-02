import { DatabaseIcon } from "lucide-react";
import type { JSX } from "react";

import { APP_NAME } from "@/lib/app-name";

export function BrandMark(): JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 font-bold">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"
      >
        <DatabaseIcon className="size-4" />
      </span>
      {APP_NAME}
    </span>
  );
}
