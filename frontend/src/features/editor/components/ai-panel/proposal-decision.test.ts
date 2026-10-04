import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";

import { AI_PANEL_TOGGLE_ID } from "./ai-panel-ids";
import { aiProposalCardId } from "./ai-proposal-card";
import { acceptSafely, focusProposalCard } from "./proposal-decision";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function addFocusable(id: string): HTMLElement {
  const element = document.createElement("div");
  element.id = id;
  element.tabIndex = -1;
  document.body.append(element);
  return element;
}

describe("acceptSafely", () => {
  it("logs only the error name when accepting throws", () => {
    const logError = vi.spyOn(logger, "error").mockImplementation(vi.fn());

    acceptSafely(() => {
      throw new TypeError("no preview for message-1");
    });

    expect(logError).toHaveBeenCalledWith("ai.proposal-accept-failed", {
      errorName: "TypeError",
    });
  });
});

describe("focusProposalCard", () => {
  it("focuses the card a task later", () => {
    vi.useFakeTimers();
    const card = addFocusable(aiProposalCardId("message-1"));
    addFocusable(AI_PANEL_TOGGLE_ID);

    focusProposalCard("message-1");
    vi.runAllTimers();

    expect(document.activeElement).toBe(card);
  });

  it("falls back to the AI toggle when the card is not on screen", () => {
    vi.useFakeTimers();
    const toggle = addFocusable(AI_PANEL_TOGGLE_ID);

    focusProposalCard("message-1");
    vi.runAllTimers();

    expect(document.activeElement).toBe(toggle);
  });
});
