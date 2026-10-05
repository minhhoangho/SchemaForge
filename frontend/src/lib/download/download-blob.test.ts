import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downloadBlob,
  OBJECT_URL_REVOKE_DELAY_MS,
  type DownloadEnvironment,
} from "./download-blob";

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(): {
  readonly environment: DownloadEnvironment;
  readonly createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
  readonly revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;
  readonly scheduled: { callback: () => void; delayMs: number }[];
} {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:test");
  const revokeObjectURL = vi.fn<(url: string) => void>();
  const scheduled: { callback: () => void; delayMs: number }[] = [];
  return {
    environment: {
      document,
      url: { createObjectURL, revokeObjectURL },
      schedule: (callback, delayMs) => {
        scheduled.push({ callback, delayMs });
      },
    },
    createObjectURL,
    revokeObjectURL,
    scheduled,
  };
}

describe("downloadBlob", () => {
  it("clicks a hidden link with the file name and object url", () => {
    const { environment, createObjectURL } = setup();
    const blob = new Blob(["x"]);
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadBlob(blob, "blog.sql", environment);

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.getAttribute("href")).toBe("blob:test");
    expect(clicked[0]?.download).toBe("blog.sql");
    expect(clicked[0]?.rel).toBe("noopener");
    expect(clicked[0]?.hidden).toBe(true);
  });

  it("revokes the object url after ten seconds", () => {
    const { environment, revokeObjectURL, scheduled } = setup();

    downloadBlob(new Blob(["x"]), "a.txt", environment);

    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.delayMs).toBe(OBJECT_URL_REVOKE_DELAY_MS);
    expect(OBJECT_URL_REVOKE_DELAY_MS).toBe(10_000);
    scheduled[0]?.callback();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("removes the link after the click", () => {
    const { environment } = setup();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(document.body.contains(this)).toBe(true);
    });

    downloadBlob(new Blob(["x"]), "a.txt", environment);

    expect(document.body.querySelector("a")).toBeNull();
  });

  it("uses the browser document, url and timer by default", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:default");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL, revokeObjectURL }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      // jsdom does not navigate.
    });

    downloadBlob(new Blob(["x"]), "a.txt");
    vi.advanceTimersByTime(OBJECT_URL_REVOKE_DELAY_MS);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:default");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
