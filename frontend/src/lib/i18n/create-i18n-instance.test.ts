import { describe, expect, it } from "vitest";

import { createI18nInstance } from "./create-i18n-instance";

describe("createI18nInstance", () => {
  it("translates right after creation without awaiting init", () => {
    const instance = createI18nInstance("vi");

    expect(instance.t("actions.cancel")).toBe("Hủy");
  });

  it("uses en as the fallback language", () => {
    const instance = createI18nInstance("vi");

    expect(instance.languages).toEqual(["vi", "en"]);
  });

  it("does not escape interpolation values", () => {
    const instance = createI18nInstance("en");

    expect(
      instance.t("issues:table-name-duplicate", { table: "<b>a</b>" }),
    ).toBe("Another table or enum is already named “<b>a</b>”.");
  });

  it("creates independent instances", async () => {
    const first = createI18nInstance("vi");
    const second = createI18nInstance("vi");

    await first.changeLanguage("en");

    expect(second.t("actions.cancel")).toBe("Hủy");
  });
});
