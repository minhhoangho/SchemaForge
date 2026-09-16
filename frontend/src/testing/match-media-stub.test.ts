import { afterEach, describe, expect, it, vi } from "vitest";

import { DARK_COLOR_SCHEME_QUERY } from "@/lib/theme/resolve-theme";

import { stubMatchMedia } from "./match-media-stub";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stubMatchMedia", () => {
  it("reports the initial dark preference", () => {
    stubMatchMedia({ isDarkPreferred: true });

    expect(window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches).toBe(true);
  });

  it("notifies change listeners when the preference changes", () => {
    const stub = stubMatchMedia({ isDarkPreferred: false });
    const query = window.matchMedia(DARK_COLOR_SCHEME_QUERY);
    const handleChange = vi.fn<(event: MediaQueryListEvent) => void>();
    query.addEventListener("change", handleChange);

    stub.setPrefersDark(true);

    expect(handleChange.mock.calls).toEqual([[{ matches: true }]]);
    expect(query.matches).toBe(true);
  });

  it("counts the change listeners that are attached", () => {
    const stub = stubMatchMedia({ isDarkPreferred: false });
    const query = window.matchMedia(DARK_COLOR_SCHEME_QUERY);
    const handleChange = vi.fn<(event: MediaQueryListEvent) => void>();
    query.addEventListener("change", handleChange);
    const countWhileListening = stub.countListeners();

    query.removeEventListener("change", handleChange);

    expect([countWhileListening, stub.countListeners()]).toEqual([1, 0]);
  });

  it("restores the original matchMedia", () => {
    const stub = stubMatchMedia({ isDarkPreferred: true });

    stub.restore();

    // The stub from setup-tests never matches, so a dark answer here would
    // mean this stub is still installed.
    expect(window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches).toBe(false);
  });
});
