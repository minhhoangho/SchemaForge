import { PRODUCT_NAME } from "@schemaforge/core";
import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";

export const metadata: Metadata = { title: PRODUCT_NAME };

type RootLayoutProps = {
  readonly children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
