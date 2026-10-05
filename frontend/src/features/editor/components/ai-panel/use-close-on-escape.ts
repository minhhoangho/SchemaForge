import type { RefObject } from "react";
import { useEffect } from "react";

import { closeToLauncher } from "./close-to-launcher";

/**
 * Escape inside the AI window closes it, except while an IME composes
 * (Vietnamese input), the same rule as the editor shortcuts.
 */
export function useCloseOnEscape(
  sectionRef: RefObject<HTMLElement | null>,
  closeAiWindow: () => void,
): void {
  // A native listener: keys from a portal opened inside (the confirm dialog,
  // which handles its own Escape) do not reach it, unlike React's bubbling.
  useEffect(() => {
    const section = sectionRef.current;
    if (section === null) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !event.isComposing
      ) {
        closeToLauncher(closeAiWindow);
      }
    }
    section.addEventListener("keydown", handleKeyDown);
    return () => {
      section.removeEventListener("keydown", handleKeyDown);
    };
  }, [sectionRef, closeAiWindow]);
}
