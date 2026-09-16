"use client";

import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  LoaderIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { JSX } from "react";
import { Toaster as SonnerToaster } from "sonner";
import type { ToasterProps } from "sonner";

import { useThemePreference } from "@/lib/theme/use-theme-preference";

// Toasts float over the canvas instead of covering the right panel, so a
// focused node or field is never fully obscured (WCAG 2.4.11).
const TOASTER_POSITION = "bottom-center";

// Sonner falls back to the English string "Notifications", so the caller must
// pass a translated name for the toast region.
type AppToasterProps = ToasterProps & { readonly containerAriaLabel: string };

export function Toaster(props: AppToasterProps): JSX.Element {
  const { preference } = useThemePreference();

  return (
    <SonnerToaster
      theme={preference}
      className="toaster group"
      position={TOASTER_POSITION}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <CircleAlertIcon className="size-4" />,
        loading: <LoaderIcon className="size-4 animate-spin" />,
      }}
      {...props}
    />
  );
}
