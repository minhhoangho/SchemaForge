import { describe, expect, it } from "vitest";

import { buildAiChatSseResponse } from "./fake-ai-chat";

async function readChunks(response: Response): Promise<readonly unknown[]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((event) => event.startsWith("data: ") && event !== "data: [DONE]")
    .map((event): unknown => JSON.parse(event.slice("data: ".length)));
}

function typesOf(chunks: readonly unknown[]): readonly unknown[] {
  return chunks.map((chunk) =>
    typeof chunk === "object" && chunk !== null && "type" in chunk
      ? chunk.type
      : null,
  );
}

describe("buildAiChatSseResponse", () => {
  it("streams the chunks of a proposal turn in contract order", async () => {
    const response = buildAiChatSseResponse({
      text: "Here you go",
      proposal: { operation: { type: "renameSchema", name: "x" } },
      findings: [
        {
          kind: "suggestion",
          category: "index",
          title: "Add an index",
          detail: "",
          targets: [],
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    expect(typesOf(await readChunks(response))).toEqual([
      "start",
      "text-start",
      "text-delta",
      "text-delta",
      "text-end",
      "data-proposal",
      "data-findings",
      "finish",
    ]);
  });

  it("ends with an error chunk and no data part for an error turn", async () => {
    const chunks = await readChunks(
      buildAiChatSseResponse({
        text: "Sorry",
        proposal: { operation: {} },
        errorCode: "ai-timeout",
      }),
    );

    expect(typesOf(chunks).slice(-2)).toEqual(["text-end", "error"]);
    expect(chunks.at(-1)).toEqual({ type: "error", errorText: "ai-timeout" });
    expect(typesOf(chunks)).not.toContain("data-proposal");
    expect(typesOf(chunks)).not.toContain("finish");
  });
});
