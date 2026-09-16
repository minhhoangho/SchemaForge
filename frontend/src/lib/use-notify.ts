"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { NAMESPACES } from "@/lib/i18n/resources";

import type { Notify } from "./notify";
import { createNotify } from "./notify";

export function useNotify(): Notify {
  const { t } = useTranslation([...NAMESPACES]);

  return useMemo(() => createNotify((key, values) => t(key, values)), [t]);
}
