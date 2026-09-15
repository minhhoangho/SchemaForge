import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";

import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = { title: APP_NAME };

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
