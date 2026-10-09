import { act, renderHook, waitFor } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/i18n-provider";
import {
  createFakeImporterClient,
  successOutcome,
  syntaxError,
} from "@/testing/fake-importer-client";

import {
  useImportDialog,
  type UseImportDialogOptions,
} from "./use-import-dialog";

function Wrapper({ children }: { readonly children: ReactNode }): JSX.Element {
  return <I18nProvider locale="en">{children}</I18nProvider>;
}

function setup(options: Partial<UseImportDialogOptions> = {}): {
  client: ReturnType<typeof createFakeImporterClient>;
  result: ReturnType<
    typeof renderHook<ReturnType<typeof useImportDialog>, unknown>
  >["result"];
  rerender: (props: Partial<UseImportDialogOptions>) => void;
} {
  const client = createFakeImporterClient();
  const createClient = (): typeof client => client;
  const base: UseImportDialogOptions = {
    isActive: true,
    mergeTarget: null,
    rememberedSqlDialect: "postgresql",
    onSqlDialectChange: vi.fn(),
    createClient,
    ...options,
  };
  const view = renderHook(
    (props: Partial<UseImportDialogOptions>) =>
      useImportDialog({ ...base, ...props }),
    { wrapper: Wrapper, initialProps: {} },
  );
  return { client, result: view.result, rerender: view.rerender };
}

async function startAnalysis(
  result: ReturnType<typeof setup>["result"],
  client: ReturnType<typeof createFakeImporterClient>,
): Promise<void> {
  act(() => {
    result.current.updateForm({
      tab: "paste",
      text: "CREATE TABLE a (id int);",
    });
  });
  act(() => {
    result.current.analyze();
  });
  await waitFor(() => {
    expect(client.run).toHaveBeenCalled();
  });
}

describe("useImportDialog", () => {
  it("moves from source to analyzing to preview", async () => {
    const { result, client } = setup();
    expect(result.current.state.step).toBe("source");

    await startAnalysis(result, client);

    expect(result.current.state.step).toBe("analyzing");

    await act(async () => {
      client.settle(successOutcome());
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.state.step).toBe("preview");
    });
  });

  it("returns to source on cancel and terminates the worker", async () => {
    const { result, client } = setup();
    await startAnalysis(result, client);

    act(() => {
      result.current.cancel();
    });

    expect(client.cancel).toHaveBeenCalledOnce();
    expect(result.current.state).toStrictEqual({ step: "source", error: null });
  });

  it("ignores the result of a run that was cancelled", async () => {
    const { result, client } = setup();
    await startAnalysis(result, client);

    act(() => {
      result.current.cancel();
    });
    await act(async () => {
      client.settle(successOutcome());
      await Promise.resolve();
    });

    expect(result.current.state.step).toBe("source");
  });

  it("shows the timeout message after a timeout", async () => {
    const { result, client } = setup();
    await startAnalysis(result, client);

    await act(async () => {
      client.settle({ kind: "timeout" });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.state).toStrictEqual({
        step: "source",
        error: "timeout",
      });
    });
  });

  it("reports a crashed worker and keeps the failure diagnostics", async () => {
    const { result, client } = setup();
    await startAnalysis(result, client);
    await act(async () => {
      client.settle({ requestId: 1, kind: "crashed" });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.state).toStrictEqual({
        step: "source",
        error: "workerFailed",
      });
    });

    act(() => {
      result.current.analyze();
    });
    await waitFor(() => {
      expect(client.run).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      client.settle({
        requestId: 2,
        kind: "failure",
        diagnostics: [syntaxError(1, 1)],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.state.step).toBe("failed");
    });
    act(() => {
      result.current.back();
    });
    expect(result.current.state.step).toBe("source");
    expect(result.current.hasLeftSource).toBe(true);
  });

  it("does not create a client while inactive", () => {
    const { client } = setup({ isActive: false });

    expect(client.prepare).not.toHaveBeenCalled();
  });

  it("disposes the client when it becomes inactive", () => {
    const { client, rerender } = setup();

    rerender({ isActive: false });

    expect(client.dispose).toHaveBeenCalledOnce();
  });

  it("asks for a dialect instead of running sql without one", () => {
    const { result, client } = setup({ rememberedSqlDialect: null });
    act(() => {
      result.current.updateForm({ tab: "paste", text: "select 1" });
    });

    act(() => {
      result.current.analyze();
    });

    expect(result.current.state).toStrictEqual({
      step: "source",
      error: "dialectRequired",
    });
    expect(client.run).not.toHaveBeenCalled();

    act(() => {
      result.current.selectDialect("mysql");
    });

    expect(result.current.state).toStrictEqual({ step: "source", error: null });
  });

  it("clears the source error when the input changes", async () => {
    const { result, client } = setup();
    await startAnalysis(result, client);
    await act(async () => {
      client.settle({ kind: "timeout" });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.state).toMatchObject({ error: "timeout" });
    });

    act(() => {
      result.current.updateForm({ text: "changed" });
    });

    expect(result.current.state).toStrictEqual({ step: "source", error: null });
  });

  it("does not run a file that decodes to blank text", async () => {
    const { result, client } = setup();
    act(() => {
      result.current.updateForm({
        tab: "file",
        file: new File(["  \n "], "blank.sql"),
      });
    });

    act(() => {
      result.current.analyze();
    });

    await waitFor(() => {
      expect(result.current.state).toStrictEqual({
        step: "source",
        error: "emptySource",
      });
    });
    expect(client.run).not.toHaveBeenCalled();
  });

  it("does not run when it is closed while the file is still being read", async () => {
    const { result, client, rerender } = setup();
    let finishRead: (buffer: ArrayBuffer) => void = () => undefined;
    const file = new File(["select 1"], "slow.sql");
    vi.spyOn(file, "arrayBuffer").mockReturnValue(
      new Promise<ArrayBuffer>((resolve) => {
        finishRead = resolve;
      }),
    );
    act(() => {
      result.current.updateForm({ tab: "file", file });
    });
    act(() => {
      result.current.analyze();
    });

    rerender({ isActive: false });
    await act(async () => {
      finishRead(new TextEncoder().encode("select 1").buffer);
      await Promise.resolve();
    });

    expect(client.run).not.toHaveBeenCalled();
  });

  it("reports an unreadable file instead of leaving it analyzing", async () => {
    const { result, client } = setup();
    const file = new File(["select 1"], "locked.sql");
    vi.spyOn(file, "arrayBuffer").mockRejectedValue(
      new DOMException("locked", "NotReadableError"),
    );
    act(() => {
      result.current.updateForm({ tab: "file", file });
    });

    act(() => {
      result.current.analyze();
    });

    await waitFor(() => {
      expect(result.current.state).toStrictEqual({
        step: "source",
        error: "workerFailed",
      });
    });
    expect(client.run).not.toHaveBeenCalled();
  });

  it("fails empty pasted text without entering the analyzing step", () => {
    const { result, client } = setup();
    act(() => {
      result.current.updateForm({ tab: "paste", text: "  " });
    });

    act(() => {
      result.current.analyze();
    });

    expect(result.current.state).toStrictEqual({
      step: "source",
      error: "emptySource",
    });
    expect(client.run).not.toHaveBeenCalled();
  });
});
