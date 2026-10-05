// Kept apart from the panel so the window and the proposal actions can return
// focus to the launcher without the launcher loading the lazy panel (AI plan,
// issue 33).
export const AI_LAUNCHER_ID = "ai-assistant-launcher";

// The header's Minimize/Restore button: the last place focus can go on a narrow
// screen, where a minimized window hides the proposal card and the launcher.
export const AI_RESTORE_ID = "ai-assistant-restore";

// Marks the open, full-size AI window, so the canvas can pan a keyboard-focused
// node out from under it (WCAG 2.4.11).
export const AI_WINDOW_OVERLAY_ATTRIBUTE = "data-ai-window-overlay";
