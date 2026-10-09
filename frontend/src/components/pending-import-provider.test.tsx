import type { BatchOperation } from "@schemaforge/core";
import { act, render, renderHook } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { describe, expect, it } from "vitest";

import {
  PendingImportProvider,
  usePendingImport,
} from "./pending-import-provider";

const OPERATION: BatchOperation = { type: "batch", operations: [] };

function wrapper({ children }: { readonly children: ReactNode }): JSX.Element {
  return <PendingImportProvider>{children}</PendingImportProvider>;
}

describe("PendingImportProvider", () => {
  it("takes the pending import once for its schema", () => {
    const { result } = renderHook(() => usePendingImport(), { wrapper });

    result.current.setPendingImport({ schemaId: "a", operation: OPERATION });

    expect([
      result.current.takePendingImport("a"),
      result.current.takePendingImport("a"),
    ]).toStrictEqual([OPERATION, null]);
  });

  it("keeps the pending import for another schema", () => {
    const { result } = renderHook(() => usePendingImport(), { wrapper });

    result.current.setPendingImport({ schemaId: "a", operation: OPERATION });

    expect([
      result.current.takePendingImport("b"),
      result.current.takePendingImport("a"),
    ]).toStrictEqual([null, OPERATION]);
  });

  it("keeps pending imports apart for two provider instances", () => {
    const first = renderHook(() => usePendingImport(), { wrapper });
    const second = renderHook(() => usePendingImport(), { wrapper });

    first.result.current.setPendingImport({
      schemaId: "a",
      operation: OPERATION,
    });

    expect(second.result.current.takePendingImport("a")).toBeNull();
  });

  it("remembers the last sql dialect until unmount", () => {
    const { result, unmount } = renderHook(() => usePendingImport(), {
      wrapper,
    });
    act(() => {
      result.current.setLastSqlDialect("mysql");
    });

    expect(result.current.lastSqlDialect).toBe("mysql");
    unmount();
    const fresh = renderHook(() => usePendingImport(), { wrapper });
    expect(fresh.result.current.lastSqlDialect).toBeNull();
  });

  it("keeps the same functions across renders", () => {
    const { result, rerender } = renderHook(() => usePendingImport(), {
      wrapper,
    });
    const before = result.current.takePendingImport;

    rerender();

    expect(result.current.takePendingImport).toBe(before);
  });

  it("throws outside the provider", () => {
    function Probe(): JSX.Element {
      usePendingImport();
      return <p>unreachable</p>;
    }

    expect(() => render(<Probe />)).toThrow(/PendingImportProvider/);
  });
});
