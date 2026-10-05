import { describe, expect, it } from "vitest";

import type {
  AiAssistantMessage,
  AiChatEntry,
  AiUserMessage,
} from "../state/create-ai-chat-store";
import { buildAiChatHistory } from "./build-ai-chat-history";

function user(text: string, id = "u"): AiUserMessage {
  return { id, role: "user", text, createdAt: 0 };
}

function assistant(
  overrides: Partial<AiAssistantMessage> = {},
): AiAssistantMessage {
  return {
    id: "a",
    role: "assistant",
    text: "reply",
    createdAt: 0,
    status: "done",
    failure: null,
    proposal: null,
    findings: null,
    sampleDataset: null,
    ...overrides,
  };
}

function proposal(
  state: NonNullable<AiAssistantMessage["proposal"]>["state"],
): AiAssistantMessage["proposal"] {
  return { operation: {}, stoppedEarly: false, state };
}

function pairs(count: number): AiChatEntry[] {
  return Array.from({ length: count }, (_, index) => [
    user(`q${String(index)}`),
    assistant({ text: `a${String(index)}` }),
  ]).flat();
}

describe("buildAiChatHistory", () => {
  it("keeps the last 40 messages", () => {
    const history = buildAiChatHistory([...pairs(30), user("last")]);

    expect(history).toHaveLength(40);
    expect(history.at(-1)).toEqual({ role: "user", text: "last" });
    expect(history[0]).toEqual({ role: "assistant", text: "a10" });
  });

  it("cuts the end of an assistant text over 8000 characters", () => {
    const history = buildAiChatHistory([
      user("q"),
      assistant({ text: "x".repeat(9000) }),
      user("next"),
    ]);

    expect(history[1]?.text).toHaveLength(8000);
  });

  it("drops the oldest messages until the total is at most 60000 characters", () => {
    const long = "y".repeat(4000);
    const entries = Array.from({ length: 20 }, (_, index) =>
      user(`${String(index)}${long}`),
    );

    const history = buildAiChatHistory(entries);

    const total = history.reduce(
      (sum, message) => sum + message.text.length,
      0,
    );
    expect(total).toBeLessThanOrEqual(60_000);
    expect(history.at(-1)?.text.startsWith("19")).toBe(true);
    expect(history[0]?.text.startsWith("0")).toBe(false);
  });

  it("appends a numbered findings block within the length limit", () => {
    const findings = [{ title: "One" }, { title: "Two" }].map((item) => ({
      kind: "issue" as const,
      category: "other" as const,
      detail: "",
      targets: [],
      ...item,
    }));

    const history = buildAiChatHistory([
      user("q"),
      assistant({ text: "z".repeat(8000), findings }),
      user("next"),
    ]);

    const text = history[1]?.text ?? "";
    expect(text).toHaveLength(8000);
    expect(text.endsWith("\n\n[findings]\n1. One\n2. Two")).toBe(true);
  });

  it("uses only the findings block for an assistant message with no text", () => {
    const findings = [
      {
        kind: "suggestion" as const,
        category: "index" as const,
        title: "Add index",
        detail: "",
        targets: [],
      },
    ];

    const history = buildAiChatHistory([
      user("q"),
      assistant({ text: "", findings }),
      user("next"),
    ]);

    expect(history[1]?.text).toBe("[findings]\n1. Add index");
  });

  it("sends accepted for an accepted proposal and discarded for every other proposal", () => {
    const history = buildAiChatHistory([
      user("1"),
      assistant({ proposal: proposal("accepted") }),
      user("2"),
      assistant({ proposal: proposal("preview") }),
      user("3"),
      assistant({ proposal: proposal("stale") }),
      user("4"),
    ]);

    expect(
      history.flatMap((message) =>
        message.role === "assistant" ? [message.proposalOutcome] : [],
      ),
    ).toEqual(["accepted", "discarded", "discarded"]);
  });

  it("skips streaming and failed assistant messages", () => {
    const history = buildAiChatHistory([
      user("1"),
      assistant({ status: "failed" }),
      user("2"),
      assistant({ status: "streaming" }),
      user("3"),
    ]);

    expect(history.map((message) => message.role)).toEqual([
      "user",
      "user",
      "user",
    ]);
  });

  it("uses a marker text for an assistant message with only a proposal", () => {
    const history = buildAiChatHistory([
      user("q"),
      assistant({ text: "", proposal: proposal("accepted") }),
      user("q2"),
      assistant({ text: " ", sampleDataset: { rows: [] } }),
      user("q3"),
      assistant({ text: "" }),
      user("q4"),
    ]);

    expect(history.map((message) => message.text)).toEqual([
      "q",
      "[proposal]",
      "q2",
      "[sample data]",
      "q3",
      "q4",
    ]);
  });

  it("always ends with a user message", () => {
    const history = buildAiChatHistory([user("q"), assistant()]);

    expect(history).toEqual([{ role: "user", text: "q" }]);
  });
});
