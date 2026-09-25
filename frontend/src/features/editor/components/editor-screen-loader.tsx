"use client";

// This module is the client entry of the `/schemas/[schemaId]` route. Zod reads
// `jitless` when a schema is created, and the editor screen loaded below
// creates schemas on import (core, storage records), so the configuration must
// load first or the CSP blocks Zod's eval.
import "@/lib/zod-config";

import dynamic from "next/dynamic";
import type { JSX } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/auth-provider";

import { EditorSkeleton } from "./editor-skeleton";

// React Flow, Dexie and the editor store load only when an editor opens, and
// never on the server: the schema lives in IndexedDB and the canvas measures
// the DOM. `ssr: false` is only allowed in a client component.
const EditorScreen = dynamic(
  () => import("./editor-screen").then((module) => module.EditorScreen),
  { ssr: false, loading: () => <EditorSkeleton /> },
);

export type EditorScreenLoaderProps = { readonly schemaId: string };

/**
 * Loads the editor screen and keeps the one loading status outside the
 * dynamic boundary, so it stays mounted while the skeleton is replaced at each
 * opening step and screen readers hear "opening" once.
 */
export function EditorScreenLoader({
  schemaId,
}: EditorScreenLoaderProps): JSX.Element {
  const { t } = useTranslation("editor");
  const [isOpening, setIsOpening] = useState(true);
  // The open decision depends on who is signed in, so the editor waits for
  // auth; the status keeps saying "opening" meanwhile.
  const isAuthUnknown = useAuth((state) => state.auth.status === "unknown");

  return (
    <>
      <p role="status" className="sr-only">
        {isAuthUnknown || isOpening ? t("screen.loading") : null}
      </p>
      {isAuthUnknown ? (
        <EditorSkeleton />
      ) : (
        <EditorScreen schemaId={schemaId} onOpeningChange={setIsOpening} />
      )}
    </>
  );
}
