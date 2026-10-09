import type { ImportDiagnostic, SqlDialect } from "@schemaforge/core";
import { buildSchema, makeTable } from "@schemaforge/core/testing";
import { act, screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { useCallback, useRef, useState, type JSX } from "react";
import { describe, expect, it, vi } from "vitest";

import { MAX_IMPORT_FILE_BYTES } from "@/lib/import-export/decode-import-file";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import {
  createFakeImporterClient,
  IMPORTED_DOCUMENT,
  successOutcome,
  syntaxError,
  type FakeImporterClient,
} from "@/testing/fake-importer-client";
import { renderWithProviders } from "@/testing/render-with-providers";

import { ImportDialog, type ImportDialogProps } from "./import-dialog";

const MERGE_TARGET = {
  document: IMPORTED_DOCUMENT,
  origin: { x: 400, y: 0 },
} as const;

type Setup = {
  readonly client: FakeImporterClient;
  readonly user: UserEvent;
  readonly onConfirm: ReturnType<typeof vi.fn<ImportDialogProps["onConfirm"]>>;
  readonly onOpenChange: ReturnType<
    typeof vi.fn<ImportDialogProps["onOpenChange"]>
  >;
  readonly rerender: (props?: Partial<ImportDialogProps>) => void;
};

function setup(
  props: Partial<ImportDialogProps> = {},
  theme: "light" | "dark" = "light",
): Setup {
  const client = createFakeImporterClient();
  const onConfirm = vi.fn<ImportDialogProps["onConfirm"]>();
  const onOpenChange = vi.fn<ImportDialogProps["onOpenChange"]>();
  const build = (overrides: Partial<ImportDialogProps>): ImportDialogProps => ({
    isOpen: true,
    onOpenChange,
    mergeTarget: null,
    onConfirm,
    rememberedSqlDialect: "postgresql",
    onSqlDialectChange: vi.fn(),
    onReturnFocus: vi.fn(),
    createClient: () => client,
    ...props,
    ...overrides,
  });
  const view = renderWithProviders(<ImportDialog {...build({})} />, {
    locale: "en",
    themePreference: theme,
  });
  return {
    client,
    user: view.user,
    onConfirm,
    onOpenChange,
    rerender: (overrides = {}) => {
      view.rerender(<ImportDialog {...build(overrides)} />);
    },
  };
}

const fileInput = (): HTMLElement =>
  screen.getByLabelText("Choose a file", { selector: "input" });
const analyzeButton = (): HTMLElement =>
  screen.getByRole("button", { name: "Analyze" });

function descriptionOf(element: HTMLElement): string {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .trim();
}

async function pasteAndAnalyze(user: UserEvent, text = "x"): Promise<void> {
  await user.click(screen.getByRole("tab", { name: "Paste text" }));
  await user.click(screen.getByRole("textbox", { name: "Source" }));
  await user.paste(text);
  await user.click(screen.getByRole("button", { name: "Analyze" }));
}

async function reply(
  client: FakeImporterClient,
  outcome: Parameters<FakeImporterClient["settle"]>[0],
): Promise<void> {
  await waitFor(() => {
    expect(client.run).toHaveBeenCalled();
  });
  await act(async () => {
    client.settle(outcome);
    await Promise.resolve();
  });
}

async function chooseOption(
  user: UserEvent,
  label: string,
  option: string,
): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

function tableDifferences(count: number): readonly ImportDiagnostic[] {
  return Array.from({ length: count }, () => ({
    code: "table-renamed",
    location: null,
    path: ["tables", "tbl_users"],
  }));
}

function OpenerHarness({
  client,
}: {
  readonly client: FakeImporterClient;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const createClient = useCallback(() => client, [client]);
  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Open importer
      </button>
      <ImportDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        mergeTarget={null}
        onConfirm={vi.fn()}
        rememberedSqlDialect="postgresql"
        onSqlDialectChange={vi.fn()}
        onReturnFocus={() => {
          openerRef.current?.focus();
        }}
        createClient={createClient}
      />
    </>
  );
}

describe("ImportDialog", () => {
  it("returns focus to the opener and calls onReturnFocus when it closes", async () => {
    const client = createFakeImporterClient();
    const { user } = renderWithProviders(<OpenerHarness client={client} />, {
      locale: "en",
    });
    const opener = screen.getByRole("button", { name: "Open importer" });

    await user.click(opener);
    await user.click(await screen.findByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });
  });

  it("moves focus into the new-schema preview, to the name", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user);
    await reply(client, successOutcome());

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "Schema name" }),
      );
    });
  });

  it("moves focus into the merge preview, to the import button", async () => {
    const { user, client } = setup({ mergeTarget: MERGE_TARGET });
    await user.click(
      screen.getByRole("radio", { name: "Add to the current schema" }),
    );

    await pasteAndAnalyze(user);
    await reply(client, successOutcome());

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Import" }),
      );
    });
  });

  it("announces source errors and clears them when the input changes", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("tab", { name: "Paste text" }));
    await user.click(analyzeButton());

    const alert = await screen.findByRole("alert");
    const text = screen.getByRole("textbox", { name: "Source" });
    expect(alert.textContent).toBe("Choose a file or paste some text first.");
    expect(text.getAttribute("aria-invalid")).toBe("true");

    await user.type(text, "x");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(text.getAttribute("aria-invalid")).toBeNull();
  });

  it("marks the error column with a mark and no caret line", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user, "CREATE TABEL a;");
    await reply(client, {
      requestId: 1,
      kind: "failure",
      diagnostics: [syntaxError(1, 8)],
    });

    expect(
      (await screen.findByText("T", { selector: "mark" })).textContent,
    ).toBe("T");
    expect(document.body.textContent).not.toContain("^");
  });

  it("calls onReturnFocus when the dialog closes", async () => {
    const onReturnFocus = vi.fn();
    const { rerender } = setup({ onReturnFocus });

    rerender({ isOpen: false, onReturnFocus });

    await waitFor(() => {
      expect(onReturnFocus).toHaveBeenCalled();
    });
  });

  it("creates the worker when it opens and ends it when it closes", () => {
    const { client, rerender } = setup();

    expect(client.prepare).toHaveBeenCalledOnce();

    rerender({ isOpen: false });

    expect(client.dispose).toHaveBeenCalledOnce();
  });

  it("links to the licenses of the bundled parsers", () => {
    setup();

    expect(
      screen
        .getByRole("link", { name: /Licenses of the bundled parsers/u })
        .getAttribute("href"),
    ).toBe("/third-party-notices.txt");
  });

  it("picks the format from the file extension", async () => {
    const { user } = setup();

    await user.upload(fileInput(), new File(["model A {}"], "schema.prisma"));

    expect(screen.getByRole("combobox", { name: "Format" }).textContent).toBe(
      "Prisma",
    );
    expect(screen.getByText("Selected file: schema.prisma")).toBeDefined();
  });

  it("keeps the analyze button enabled and reports a missing dialect", async () => {
    const onSqlDialectChange = vi.fn<(dialect: SqlDialect) => void>();
    const { user, client } = setup({
      rememberedSqlDialect: null,
      onSqlDialectChange,
    });
    await user.click(screen.getByRole("tab", { name: "Paste text" }));
    await user.click(screen.getByRole("textbox", { name: "Source" }));
    await user.paste("select 1");

    await user.click(analyzeButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Choose a SQL dialect first.");
    const trigger = screen.getByRole("combobox", { name: "SQL dialect" });
    expect(trigger.getAttribute("aria-invalid")).toBe("true");
    expect(descriptionOf(trigger)).toBe("Choose a SQL dialect first.");
    expect(document.activeElement).toBe(trigger);
    expect(
      screen
        .getByRole("textbox", { name: "Source" })
        .getAttribute("aria-invalid"),
    ).toBeNull();
    expect(client.run).not.toHaveBeenCalled();

    await chooseOption(user, "SQL dialect", "MySQL");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(onSqlDialectChange).toHaveBeenCalledWith("mysql");
  });

  it("starts from the remembered dialect", () => {
    setup({ rememberedSqlDialect: "sqlserver" });

    expect(
      screen.getByRole("combobox", { name: "SQL dialect" }).textContent,
    ).toBe("SQL Server");
  });

  it("rejects a file over the limit without analyzing", async () => {
    const { user, client } = setup();
    const file = new File(["x"], "big.sql");
    Object.defineProperty(file, "size", { value: MAX_IMPORT_FILE_BYTES + 1 });

    await user.upload(fileInput(), file);
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(
      await screen.findByText("The file is larger than 2 MB.", {}),
    ).toBeDefined();
    expect(client.run).not.toHaveBeenCalled();
    expect(descriptionOf(fileInput())).toBe("The file is larger than 2 MB.");
  });

  it("rejects a file that is not utf-8 or utf-16 without analyzing", async () => {
    const { user, client } = setup();
    const file = new File([new Uint8Array([0xff, 0xff, 0xff])], "bad.sql");

    await user.upload(fileInput(), file);
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(
      await screen.findByText("Only UTF-8 and UTF-16 files are supported."),
    ).toBeDefined();
    expect(client.run).not.toHaveBeenCalled();
  });

  it("rejects empty pasted text without analyzing", async () => {
    const { user, client } = setup();

    await user.click(screen.getByRole("tab", { name: "Paste text" }));
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(
      await screen.findByText("Choose a file or paste some text first."),
    ).toBeDefined();
    expect(client.run).not.toHaveBeenCalled();
  });

  it("sends the decoded source with the chosen dialect and layout", async () => {
    const { user, client } = setup({ rememberedSqlDialect: "mysql" });

    await pasteAndAnalyze(user, "CREATE TABLE a (id int);");
    await waitFor(() => {
      expect(client.run).toHaveBeenCalled();
    });

    expect(client.requests[0]).toMatchObject({
      format: "mysql",
      source: "CREATE TABLE a (id int);",
      mode: { mode: "new" },
      target: null,
    });
  });

  it("shows a waiting state with a cancel button while analyzing sql", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user);

    const cancel = await screen.findByRole("button", { name: "Cancel" });
    expect(document.activeElement).toBe(cancel);
    expect(screen.getByRole("status").textContent).toMatch(
      /Analyzing….*parser of about 3 MB/u,
    );

    await user.click(cancel);

    expect(client.cancel).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("tab", { name: "Paste text" }),
    ).toBeDefined();
    expect(document.activeElement).toBe(analyzeButton());
  });

  it("does not mention the parser download for json", async () => {
    const { user } = setup();

    await chooseOption(user, "Format", "JSON");
    await pasteAndAnalyze(user, "{}");

    await screen.findByRole("button", { name: "Cancel" });
    expect(screen.getByRole("status").textContent).toBe("Analyzing…");
    expect(screen.queryByText(/parser of about 3 MB/u)).toBeNull();
  });

  it("shows translated errors with line, column and excerpt and no import button", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user, "first\nCREATE TABEL a;");
    await reply(client, {
      requestId: 1,
      kind: "failure",
      diagnostics: [
        syntaxError(2, 8),
        { code: "invalid-shape", location: null, path: null },
      ],
    });

    expect(
      await screen.findByText("The source has a syntax error here."),
    ).toBeDefined();
    expect(screen.getByText("Line 2, column 8")).toBeDefined();
    expect(
      screen.getByText((_, element) => {
        return (
          element?.tagName === "PRE" &&
          element.textContent === "CREATE TABEL a;"
        );
      }),
    ).toBeDefined();
    expect(
      screen.getByText("The saved data does not have the expected structure."),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeDefined();
  });

  it("moves focus to the first error", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user, "bad");
    await reply(client, {
      requestId: 1,
      kind: "failure",
      diagnostics: [syntaxError(1, 1), syntaxError(1, 2)],
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getAllByRole("listitem")[0]);
    });
  });

  it("goes back to the source with the text kept", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user, "bad");
    await reply(client, {
      requestId: 1,
      kind: "failure",
      diagnostics: [syntaxError(1, 1)],
    });
    await user.click(await screen.findByRole("button", { name: "Back" }));

    const source = await screen.findByRole("textbox", { name: "Source" });
    expect(source).toHaveProperty("value", "bad");
  });

  it("shows counts, differences and introduced issues in the preview", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user);
    await reply(
      client,
      successOutcome({
        summary: {
          tables: 12,
          columns: 40,
          relations: 1,
          indexes: 2,
          enums: 3,
          subjectAreas: 1,
          notes: 1,
        },
        diagnostics: [
          {
            code: "table-renamed",
            location: null,
            path: ["tables", "tbl_users"],
          },
        ],
        introducedIssues: [
          { code: "table-name-duplicate", path: ["tables", "tbl_users"] },
        ],
      }),
    );

    expect(await screen.findByText("12 tables", {})).toBeDefined();
    expect(screen.getByText("40 columns")).toBeDefined();
    expect(screen.getByText("1 subject area")).toBeDefined();
    expect(screen.getByText("1 note")).toBeDefined();
    expect(screen.getByText("1 difference from the source")).toBeDefined();
    expect(
      screen.getByText(
        "The table was renamed because its name matched an existing table.",
      ),
    ).toBeDefined();
    expect(screen.getByText("1 issue to fix after importing")).toBeDefined();
    expect(
      screen.getByText("Another table or enum is already named “users”."),
    ).toBeDefined();
    expect(screen.getAllByText("users")).toHaveLength(2);
  });

  it("says when the result matches the source and has no issues", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user);
    await reply(client, successOutcome());

    expect(
      await screen.findByText("The result matches the source.", {}),
    ).toBeDefined();
    expect(screen.getByText("No issues.")).toBeDefined();
  });

  it("limits each list to 200 rows with a count of the rest", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user);
    await reply(client, successOutcome({ diagnostics: tableDifferences(250) }));

    const list = await screen.findByRole("list", {
      name: /250 differences from the source/u,
    });
    expect(within(list).getAllByRole("listitem")).toHaveLength(200);
    expect(screen.getByText("and 50 more items")).toBeDefined();
  });

  it("requires a non-empty schema name in new mode", async () => {
    const { user, client, onConfirm } = setup();

    await pasteAndAnalyze(user);
    await reply(client, successOutcome());
    const name = await screen.findByRole("textbox", { name: "Schema name" });
    expect(name).toHaveProperty("value", "Shop");
    await user.clear(name);
    await user.type(name, "   ");
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("Enter a name.")).toBeDefined();
    expect(document.activeElement).toBe(name);
    expect(descriptionOf(name)).toBe("Enter a name.");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("offers the merge mode only with a merge target", async () => {
    const { rerender, user } = setup({ mergeTarget: null });

    expect(screen.queryByRole("radio")).toBeNull();

    rerender({ mergeTarget: MERGE_TARGET });

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(
      screen
        .getByRole("radio", { name: "A new schema" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    await user.click(
      screen.getByRole("radio", { name: "Add to the current schema" }),
    );
    expect(
      screen
        .getByRole("radio", { name: "Add to the current schema" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("confirms a new import with the edited name and closes", async () => {
    const { user, client, onConfirm, onOpenChange } = setup();
    const outcome = successOutcome();

    await pasteAndAnalyze(user);
    await reply(client, outcome);
    const name = await screen.findByRole("textbox", { name: "Schema name" });
    await user.clear(name);
    await user.type(name, "  My shop ");
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      mode: "new",
      schemaName: "My shop",
      operation: outcome.operation,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("confirms a merge with the target and the summary", async () => {
    const { user, client, onConfirm } = setup({ mergeTarget: MERGE_TARGET });
    const outcome = successOutcome();

    await user.click(
      screen.getByRole("radio", { name: "Add to the current schema" }),
    );
    await pasteAndAnalyze(user);
    await reply(client, outcome);
    await user.click(await screen.findByRole("button", { name: "Import" }));

    expect(client.requests[0]).toMatchObject({
      mode: { mode: "merge", origin: MERGE_TARGET.origin },
      target: MERGE_TARGET.document,
    });
    expect(screen.queryByRole("textbox", { name: "Schema name" })).toBeNull();
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      mode: "merge",
      operation: outcome.operation,
      target: MERGE_TARGET.document,
      summary: outcome.summary,
    });
  });

  it("announces the analysis result politely", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user);
    await reply(
      client,
      successOutcome({
        diagnostics: tableDifferences(3),
        introducedIssues: [
          { code: "table-name-duplicate", path: ["tables", "tbl_users"] },
        ],
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "Analysis finished: 1 table, 3 differences from the source, 1 issue to fix after importing.",
      );
    });
  });

  it("announces a failed analysis", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user);
    await reply(client, {
      requestId: 1,
      kind: "failure",
      diagnostics: [syntaxError(1, 1), syntaxError(1, 2)],
    });

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "The source could not be read: 2 errors.",
      );
    });
  });

  it("shows the timeout and worker errors on the source step", async () => {
    const { user, client } = setup();

    await pasteAndAnalyze(user);
    await reply(client, { kind: "timeout" });

    expect(
      await screen.findByText("Analyzing took too long and was stopped."),
    ).toBeDefined();
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Source" }),
    );

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await reply(client, { requestId: 2, kind: "crashed" });

    expect(
      await screen.findByText("Could not analyze the source. Try again."),
    ).toBeDefined();
  });

  it("disables import during an AI proposal preview", async () => {
    const { user, client, rerender, onConfirm, onOpenChange } = setup();

    await pasteAndAnalyze(user);
    await reply(client, successOutcome());
    await screen.findByRole("button", { name: "Import" });

    rerender({ isBlocked: true });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(client.dispose).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByLabelText("Choose a file")).toBeNull();
    expect(screen.queryByText("Or drop a file here")).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disposes the client when the dialog is closed with escape", async () => {
    const { user, client, onOpenChange, rerender } = setup();

    await pasteAndAnalyze(user);
    await screen.findByRole("button", { name: "Cancel" });
    await user.keyboard("{Escape}");
    rerender({ isOpen: false });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(client.dispose).toHaveBeenCalled();
    expect(client.cancel).not.toHaveBeenCalled();
  });

  it("renders a script-like table name as text", async () => {
    const { user, client } = setup();
    const hostile = "<img src=x onerror=alert(1)>";

    await pasteAndAnalyze(user);
    await reply(
      client,
      successOutcome({
        resultDocument: buildSchema({
          name: hostile,
          tables: [makeTable({ id: "tbl_users", name: hostile })],
        }),
        diagnostics: tableDifferences(1),
      }),
    );

    expect(await screen.findByText(hostile, {})).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Schema name" })).toHaveProperty(
      "value",
      hostile,
    );
    expect(document.querySelector("img")).toBeNull();
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in each step in the %s theme",
    async (theme) => {
      const { user, client } = setup({ mergeTarget: MERGE_TARGET }, theme);
      const dialog = (): HTMLElement => screen.getByRole("dialog");

      await expectNoAxeViolations(dialog());

      await user.click(screen.getByRole("tab", { name: "Paste text" }));
      await expectNoAxeViolations(dialog());

      await pasteAndAnalyze(user, "bad");
      await screen.findByRole("button", { name: "Cancel" });
      await expectNoAxeViolations(dialog());

      await reply(client, {
        requestId: 1,
        kind: "failure",
        diagnostics: [syntaxError(1, 2)],
      });
      await screen.findByText("The source has a syntax error here.");
      await expectNoAxeViolations(dialog());

      await user.click(screen.getByRole("button", { name: "Back" }));
      await user.click(await screen.findByRole("button", { name: "Analyze" }));
      await reply(
        client,
        successOutcome({
          requestId: 2,
          diagnostics: tableDifferences(1),
          introducedIssues: [
            { code: "table-name-duplicate", path: ["tables", "tbl_users"] },
          ],
        }),
      );
      await screen.findByRole("button", { name: "Import" });
      await expectNoAxeViolations(dialog());
    },
    30_000,
  );
});
