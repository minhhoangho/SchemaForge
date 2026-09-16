"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { NAMESPACES } from "@/lib/i18n/resources";

import type { Notify } from "./notify";
import { createNotify } from "./notify";

export function useNotify(): Notify {
  const { t } = useTranslation([...NAMESPACES]);

  // `values` is a loose dictionary, but `t(key, values)` makes i18next demand
  // exactly the interpolation variables the key's message declares, which a
  // union of every app key cannot satisfy. Passing the key as `defaultValue`
  // picks i18next's `[key, defaultValue, options]` overload, the one that takes
  // an open dictionary. It is behaviour-neutral: a missing translation already
  // falls back to the key itself.
  return useMemo(() => createNotify((key, values) => t(key, key, values)), [t]);
}
