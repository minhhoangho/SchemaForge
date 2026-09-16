"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { THEME_PREFERENCES } from "@/lib/preferences/preference-cookies";
import { useThemePreference } from "@/lib/theme/use-theme-preference";

const PREFERENCE_ICONS = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
} as const satisfies Record<ThemePreference, typeof MonitorIcon>;

export function ThemeSwitch(): JSX.Element {
  const { t } = useTranslation();
  const { preference, setPreference } = useThemePreference();
  const CurrentPreferenceIcon = PREFERENCE_ICONS[preference];

  function handleValueChange(value: string): void {
    const next = THEME_PREFERENCES.find((candidate) => candidate === value);
    if (next === undefined) {
      return;
    }

    setPreference(next);
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            {/* Icon-only button, so aria-label carries the whole name and
                WCAG 2.5.3 has no visible label to match. */}
            <Button variant="ghost" size="icon" aria-label={t("theme.label")}>
              <CurrentPreferenceIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("theme.label")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={handleValueChange}
        >
          <DropdownMenuRadioItem value="system">
            {t("theme.system")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            {t("theme.light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            {t("theme.dark")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
