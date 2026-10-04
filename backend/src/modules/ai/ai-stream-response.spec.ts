import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { UIMessageChunk } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiStreamResponse } from "./ai-stream-response.js";

const SENTINEL = "fixture-sentinel-stream-failure";

function createResponse(): ServerResponse {
  return new ServerResponse(new IncomingMessage(new Socket()));
}

function failingStream(): ReadableStream<UIMessageChunk> {
  return new ReadableStream({
    start(controller) {
      controller.error(new Error(SENTINEL));
    },
  });
}

async function createStreamResponse(): Promise<AiStreamResponse> {
  const moduleRef = await Test.createTestingModule({
    providers: [AiStreamResponse],
  }).compile();
  return moduleRef.get(AiStreamResponse);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AiStreamResponse", () => {
  it("aborts when the response closes before it finished", async () => {
    const response = createResponse();
    const signal = (await createStreamResponse()).linkAbort(response);

    response.emit("close");

    expect(signal.aborted).toBe(true);
  });

  it("aborts at once when the response was closed before the handler ran", async () => {
    const response = createResponse();
    response.destroy();

    const signal = (await createStreamResponse()).linkAbort(response);

    expect(signal.aborted).toBe(true);
  });

  it("does not abort when the response closes after it finished", async () => {
    const response = createResponse();
    vi.spyOn(response, "writableFinished", "get").mockReturnValue(true);
    const signal = (await createStreamResponse()).linkAbort(response);

    response.emit("close");

    expect(signal.aborted).toBe(false);
  });

  it("ends the response and logs only the error code when sending fails after headers were sent", async () => {
    const streamResponse = await createStreamResponse();
    const response = createResponse();
    const end = vi.spyOn(response, "end");
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);

    await streamResponse.send(response, failingStream());

    expect(response.headersSent).toBe(true);
    expect(end).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith({
      event: "ai.chat.response-failed",
      code: "internal-error",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SENTINEL);
  });

  it("rethrows when sending fails before headers were sent", async () => {
    const streamResponse = await createStreamResponse();
    const response = createResponse();
    vi.spyOn(response, "setHeaders").mockImplementation(() => {
      throw new Error("headers rejected");
    });

    await expect(
      streamResponse.send(response, failingStream()),
    ).rejects.toThrow("headers rejected");
    expect(response.headersSent).toBe(false);
  });

  it("sends the stream as server-sent events", async () => {
    const streamResponse = await createStreamResponse();
    const response = createResponse();
    const write = vi.spyOn(response, "write");

    await streamResponse.send(
      response,
      new ReadableStream<UIMessageChunk>({
        start(controller) {
          controller.enqueue({ type: "finish" });
          controller.close();
        },
      }),
    );

    expect(response.getHeader("content-type")).toBe("text/event-stream");
    expect(write).toHaveBeenCalled();
  });
});
