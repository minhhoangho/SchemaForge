import { isAiStreamErrorCode } from "@schemaforge/api-contract";
import type { UIMessageChunk } from "ai";

/**
 * Chunk types the model's UI message stream may send to the client (AI-R58).
 * Data parts and `finish` are written by `AiChatService` itself, never taken
 * from the model stream.
 */
export const AI_ALLOWED_CHUNK_TYPES: ReadonlySet<string> = new Set([
  "start",
  "text-start",
  "text-delta",
  "text-end",
  "error",
]);

/**
 * Drops every chunk type outside `AI_ALLOWED_CHUNK_TYPES` and rebuilds the
 * allowed ones field by field, so provider metadata, message metadata and any
 * field a later AI SDK version adds never reach the client.
 */
export function createAiChunkFilter(): TransformStream<
  UIMessageChunk,
  UIMessageChunk
> {
  return new TransformStream({
    transform(chunk, controller) {
      const allowed = toAllowedChunk(chunk);
      if (allowed !== null) {
        controller.enqueue(allowed);
      }
    },
  });
}

// Guard clauses instead of a switch: every type not matched here is dropped on
// purpose, including types a later AI SDK version adds, so the switch
// exhaustiveness rule does not fit this allow-list.
function toAllowedChunk(chunk: UIMessageChunk): UIMessageChunk | null {
  if (chunk.type === "start") {
    return chunk.messageId === undefined
      ? { type: "start" }
      : { type: "start", messageId: chunk.messageId };
  }
  if (chunk.type === "text-start" || chunk.type === "text-end") {
    return { type: chunk.type, id: chunk.id };
  }
  if (chunk.type === "text-delta") {
    return { type: "text-delta", id: chunk.id, delta: chunk.delta };
  }
  if (chunk.type === "error") {
    // Defense in depth: only a stream error code may leave the backend (AI-R24).
    return {
      type: "error",
      errorText: isAiStreamErrorCode(chunk.errorText)
        ? chunk.errorText
        : "internal-error",
    };
  }
  return null;
}
