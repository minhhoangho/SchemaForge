import { PRODUCT_NAME } from "@schemaforge/core";
import type { JSX } from "react";

export default function HomePage(): JSX.Element {
  return (
    <main>
      <h1>{PRODUCT_NAME}</h1>
    </main>
  );
}
