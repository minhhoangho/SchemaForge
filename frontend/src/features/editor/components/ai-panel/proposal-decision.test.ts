import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";

import { AI_LAUNCHER_ID } from "./ai-panel-ids";
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
    addFocusable(AI_LAUNCHER_ID);

    focusProposalCard("message-1");
    vi.runAllTimers();

    expect(document.activeElement).toBe(card);
  });

  it("falls back to the AI launcher when the card is not on screen", () => {
    vi.useFakeTimers();
    const launcher = addFocusable(AI_LAUNCHER_ID);

    focusProposalCard("message-1");
    vi.runAllTimers();

    expect(document.activeElement).toBe(launcher);
  });

  it("falls back to the AI launcher when the card is in a hidden part of a minimized window", () => {
    vi.useFakeTimers();
    const hiddenPart = document.createElement("div");
    hiddenPart.hidden = true;
    document.body.append(hiddenPart);
    const card = addFocusable(aiProposalCardId("message-1"));
    hiddenPart.append(card);
    const launcher = addFocusable(AI_LAUNCHER_ID);

    focusProposalCard("message-1");
    vi.runAllTimers();

    expect(document.activeElement).toBe(launcher);
  });
});
