import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

// next/font needs literal options. Every subset Google serves is downloaded
// and self-hosted at build time; `subsets` only picks the preloaded files.
export const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});

export const monoFont = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});
