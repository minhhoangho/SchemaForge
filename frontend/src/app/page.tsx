import type { JSX } from "react";

import { APP_NAME } from "@/lib/app-name";

export default function HomePage(): JSX.Element {
  return (
    <main>
      <h1>{APP_NAME}</h1>
    </main>
  );
}
