import { useSyncExternalStore } from "react";

// Tailwind's `sm` breakpoint: below it the AI window is a full-screen sheet.
export const NARROW_VIEWPORT_QUERY = "(max-width: 639.98px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW_VIEWPORT_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function getSnapshot(): boolean {
  return window.matchMedia(NARROW_VIEWPORT_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/** Whether the viewport is narrower than 640px, following resizes. */
export function useIsNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
