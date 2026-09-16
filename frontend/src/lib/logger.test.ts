import { describe, expect, it, vi } from "vitest";

import type { LogSink } from "./logger";
import { createLogger } from "./logger";

function createFakeSink() {
  return { error: vi.fn<LogSink["error"]>(), warn: vi.fn<LogSink["warn"]>() };
}

describe("createLogger", () => {
  it("writes an error event with its fields to the sink", () => {
    const sink = createFakeSink();

    createLogger(sink).error("operation.rejected", {
      code: "unknown-table",
      operation: "addColumn",
      path: ["tables", 0],
    });

    expect(sink.error).toHaveBeenCalledWith(
      "[schemaforge]",
      "operation.rejected",
      { code: "unknown-table", operation: "addColumn", path: ["tables", 0] },
    );
  });

  it("writes a warning event to the sink", () => {
    const sink = createFakeSink();

    createLogger(sink).warn("lock.stolen", { isOwner: false });

    expect(sink.warn).toHaveBeenCalledWith("[schemaforge]", "lock.stolen", {
      isOwner: false,
    });
  });

  it("passes empty fields when none are given", () => {
    const sink = createFakeSink();

    createLogger(sink).error("storage.save-failed");

    expect(sink.error).toHaveBeenCalledWith(
      "[schemaforge]",
      "storage.save-failed",
      {},
    );
  });
});
