"use client";

import type { JSX, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { createBrowserStorage } from "./create-browser-storage";
import type { StorageBundle } from "./create-browser-storage";
import { toStorageErrorCode } from "./storage-error";
import type { StorageErrorCode } from "./storage-error";

export type StorageState =
  | { readonly kind: "pending" }
  | { readonly kind: "ready"; readonly storage: StorageBundle }
  | { readonly kind: "unavailable"; readonly errorCode: StorageErrorCode };

export type StorageProviderProps = {
  readonly storage?: StorageBundle;
  readonly children: ReactNode;
};

const StorageContext = createContext<StorageState | null>(null);

export function StorageProvider({
  storage,
  children,
}: StorageProviderProps): JSX.Element {
  const [createdState, setCreatedState] = useState<StorageState>({
    kind: "pending",
  });

  // The effect is the only place that touches the browser, so the server and
  // the first client render both produce the pending state.
  useEffect(() => {
    if (storage !== undefined) {
      return;
    }

    let created: StorageBundle | null = null;
    try {
      created = createBrowserStorage();
      setCreatedState({ kind: "ready", storage: created });
    } catch (error: unknown) {
      setCreatedState({
        kind: "unavailable",
        errorCode: toStorageErrorCode(error),
      });
    }

    return () => {
      created?.database.close();
    };
  }, [storage]);

  const value = useMemo<StorageState>(
    () => (storage === undefined ? createdState : { kind: "ready", storage }),
    [storage, createdState],
  );

  return <StorageContext value={value}>{children}</StorageContext>;
}

export function useStorage(): StorageState {
  const state = useContext(StorageContext);

  if (state === null) {
    throw new Error("useStorage must be used inside a StorageProvider.");
  }

  return state;
}
