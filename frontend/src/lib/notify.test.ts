import { describe, expect, it, vi } from "vitest";

import type { ToastPort, Translate } from "./notify";
import { createNotify } from "./notify";

// Joins the key with its values so a test can see which key was translated and
// which interpolation values reached the translator.
const translate: Translate = (key, values) =>
  [key, ...Object.values(values ?? {})].join(" ");

function createFakeToastPort() {
  return {
    success: vi.fn<ToastPort["success"]>(),
    error: vi.fn<ToastPort["error"]>(),
    info: vi.fn<ToastPort["info"]>(),
  };
}

describe("createNotify", () => {
  it.each(["success", "error", "info"] as const)(
    "shows a translated %s toast",
    (tone) => {
      const toastPort = createFakeToastPort();
      const notify = createNotify(translate, toastPort);

      notify({ tone, titleKey: "storage:unknown" });

      expect(toastPort[tone]).toHaveBeenCalledWith("storage:unknown", {});
    },
  );

  it("translates the description with interpolation values", () => {
    const toastPort = createFakeToastPort();
    const notify = createNotify(translate, toastPort);

    notify({
      tone: "error",
      titleKey: "storage:quota-exceeded",
      descriptionKey: "common:actions.retry",
      values: { count: 3 },
    });

    expect(toastPort.error).toHaveBeenCalledWith("storage:quota-exceeded 3", {
      description: "common:actions.retry 3",
    });
  });

  it("omits the description when no key is given", () => {
    const toastPort = createFakeToastPort();
    const notify = createNotify(translate, toastPort);

    notify({ tone: "info", titleKey: "storage:closed" });

    expect(toastPort.info.mock.calls[0]?.[1]).toStrictEqual({});
  });

  it("adds a translated action that calls onSelect", () => {
    const toastPort = createFakeToastPort();
    const notify = createNotify(translate, toastPort);
    const onSelect = vi.fn();

    notify({
      tone: "error",
      titleKey: "storage:unknown",
      action: { labelKey: "common:actions.retry", onSelect },
    });

    expect(toastPort.error).toHaveBeenCalledWith("storage:unknown", {
      action: { label: "common:actions.retry", onClick: onSelect },
    });
  });
});
