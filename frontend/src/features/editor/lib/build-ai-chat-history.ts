import type { AiChatMessage } from "@schemaforge/api-contract";
import {
  AI_MAX_HISTORY_TEXT_LENGTH,
  AI_MAX_MESSAGES,
  AI_MAX_MESSAGE_TEXT_LENGTH,
} from "@schemaforge/api-contract";

import type {
  AiAssistantMessage,
  AiChatEntry,
} from "../state/create-ai-chat-store";

// Markers for the model only, never shown in the interface.
const PROPOSAL_MARKER = "[proposal]";
const SAMPLE_DATA_MARKER = "[sample data]";
const FINDINGS_HEADER = "[findings]";

function buildFindingsBlock(message: AiAssistantMessage): string {
  if (message.findings === null) {
    return "";
  }
  const lines = message.findings.map(
    (finding, index) => `${String(index + 1)}. ${finding.title}`,
  );
  return `${FINDINGS_HEADER}\n${lines.join("\n")}`.slice(
    0,
    AI_MAX_MESSAGE_TEXT_LENGTH,
  );
}

function pickBaseText(message: AiAssistantMessage): string {
  if (message.text.trim() !== "") {
    return message.text;
  }
  if (message.proposal !== null) {
    return PROPOSAL_MARKER;
  }
  return message.sampleDataset === null ? "" : SAMPLE_DATA_MARKER;
}

function toAssistantMessage(message: AiAssistantMessage): AiChatMessage | null {
  if (message.status === "streaming" || message.status === "failed") {
    return null;
  }
  const base = pickBaseText(message);
  const block = buildFindingsBlock(message);
  let text: string;
  if (block === "") {
    text = base.slice(0, AI_MAX_MESSAGE_TEXT_LENGTH);
  } else {
    const separator = base === "" ? "" : "\n\n";
    const room = AI_MAX_MESSAGE_TEXT_LENGTH - block.length - separator.length;
    text = `${base.slice(0, Math.max(room, 0))}${separator}${block}`;
  }
  if (text.trim() === "") {
    return null;
  }
  return message.proposal === null
    ? { role: "assistant", text }
    : {
        role: "assistant",
        text,
        proposalOutcome:
          message.proposal.state === "accepted" ? "accepted" : "discarded",
      };
}

function totalLength(messages: readonly AiChatMessage[]): number {
  return messages.reduce((sum, message) => sum + message.text.length, 0);
}

/**
 * Turns the conversation into the history sent to the backend: bounded in
 * count and size, and always ending with a user message (AI spec section 8).
 */
export function buildAiChatHistory(
  entries: readonly AiChatEntry[],
): AiChatMessage[] {
  const messages: AiChatMessage[] = [];
  for (const entry of entries) {
    if (entry.role === "user") {
      messages.push({ role: "user", text: entry.text });
      continue;
    }
    const converted = toAssistantMessage(entry);
    if (converted !== null) {
      messages.push(converted);
    }
  }
  while (messages.at(-1)?.role === "assistant") {
    messages.pop();
  }
  const recent = messages.slice(-AI_MAX_MESSAGES);
  while (
    recent.length > 1 &&
    totalLength(recent) > AI_MAX_HISTORY_TEXT_LENGTH
  ) {
    recent.shift();
  }
  return recent;
}
