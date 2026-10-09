"use client";

import type { BatchOperation, SqlDialect } from "@schemaforge/core";
import type { JSX, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type PendingImport = {
  readonly schemaId: string;
  readonly operation: BatchOperation;
};

export type PendingImportApi = {
  readonly setPendingImport: (pending: PendingImport) => void;
  // Returns and clears the entry when it belongs to `schemaId`.
  readonly takePendingImport: (schemaId: string) => BatchOperation | null;
  // The dialect picked last, so the next import starts with it.
  readonly lastSqlDialect: SqlDialect | null;
  readonly setLastSqlDialect: (dialect: SqlDialect) => void;
};

const PendingImportContext = createContext<PendingImportApi | null>(null);

type PendingImportProviderProps = { readonly children: ReactNode };

/**
 * Carries an import from the schema list to the editor of the schema it
 * created. The entry sits in a ref owned by this instance (not module state,
 * not React state): taking it clears it at once, so a StrictMode effect that
 * runs twice sees `null` the second time.
 */
export function PendingImportProvider({
  children,
}: PendingImportProviderProps): JSX.Element {
  const pendingRef = useRef<PendingImport | null>(null);
  const [lastSqlDialect, setLastSqlDialect] = useState<SqlDialect | null>(null);

  const setPendingImport = useCallback((pending: PendingImport) => {
    pendingRef.current = pending;
  }, []);
  const takePendingImport = useCallback(
    (schemaId: string): BatchOperation | null => {
      const pending = pendingRef.current;
      if (pending?.schemaId !== schemaId) {
        return null;
      }
      pendingRef.current = null;
      return pending.operation;
    },
    [],
  );
  const api = useMemo(
    () => ({
      setPendingImport,
      takePendingImport,
      lastSqlDialect,
      setLastSqlDialect,
    }),
    [setPendingImport, takePendingImport, lastSqlDialect],
  );

  return <PendingImportContext value={api}>{children}</PendingImportContext>;
}

export function usePendingImport(): PendingImportApi {
  const api = useContext(PendingImportContext);
  if (api === null) {
    throw new Error("usePendingImport needs a PendingImportProvider.");
  }
  return api;
}
