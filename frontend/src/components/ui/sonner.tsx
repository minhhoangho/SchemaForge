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
const TOAST_CLASS_NAMES = { toast: "font-sans shadow-md" };

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
        success: <CircleCheckIcon className="text-success size-4" />,
        info: <InfoIcon className="size-4 text-primary" />,
        warning: <TriangleAlertIcon className="text-warning size-4" />,
        error: <CircleAlertIcon className="size-4 text-destructive" />,
        loading: (
          <LoaderIcon className="size-4 text-muted-foreground motion-safe:animate-spin" />
        ),
      }}
      toastOptions={{ classNames: TOAST_CLASS_NAMES }}
      {...props}
    />
  );
}
