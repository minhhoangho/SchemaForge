import { render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "./i18n-provider";

function CancelLabel(): JSX.Element {
  const { t } = useTranslation();

  return <span>{t("actions.cancel")}</span>;
}

describe("I18nProvider", () => {
  it("renders children with translations for the given locale", () => {
    render(
      <I18nProvider locale="vi">
        <CancelLabel />
      </I18nProvider>,
    );

    expect(screen.getByText("Hủy")).toBeDefined();
  });

  it("keeps the i18next instance when the provider rerenders", () => {
    const { rerender } = render(
      <I18nProvider locale="vi">
        <CancelLabel />
      </I18nProvider>,
    );

    rerender(
      <I18nProvider locale="en">
        <CancelLabel />
      </I18nProvider>,
    );

    expect(screen.getByText("Hủy")).toBeDefined();
  });
});
