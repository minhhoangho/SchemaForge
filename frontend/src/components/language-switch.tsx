"use client";

import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { env } from "@/lib/env";
import { changeLocale } from "@/lib/i18n/change-locale";
import { isLocale } from "@/lib/i18n/supported-locales";

export function LanguageSwitch(): JSX.Element {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  function handleValueChange(value: string): void {
    if (!isLocale(value)) {
      return;
    }

    // Fire and forget: the menu closes right away and the refresh happens
    // once the language has changed.
    void changeLocale(value, {
      i18n,
      refresh: () => {
        router.refresh();
      },
      isSecure: env.isProduction,
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          {/* The space keeps the visible short name a separate word in the
              accessible name, so voice control can match it (WCAG 2.5.3). */}
          <span className="sr-only">{t("language.label")}</span>{" "}
          {t("language.shortName")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={i18n.language}
          onValueChange={handleValueChange}
        >
          <DropdownMenuRadioItem value="vi">
            <span lang="vi">{t("language.vi")}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">
            <span lang="en">{t("language.en")}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
