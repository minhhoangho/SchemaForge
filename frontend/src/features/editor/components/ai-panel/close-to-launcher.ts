import { flushSync } from "react-dom";

import { AI_LAUNCHER_ID } from "./ai-panel-ids";

/**
 * Closes the AI window and moves focus to the launcher. The update is flushed
 * first: on a narrow screen the launcher only renders once the window is
 * closed, and the rest of the page stops being inert.
 */
export function closeToLauncher(closeAiWindow: () => void): void {
  flushSync(closeAiWindow);
  document.getElementById(AI_LAUNCHER_ID)?.focus();
}
