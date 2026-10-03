import {
  AI_MAX_HISTORY_TEXT_LENGTH,
  AI_MAX_SCHEMA_PROMPT_LENGTH,
} from "@schemaforge/api-contract";
import type {
  AiChatMessage,
  AiLocale,
  AiProposalOutcome,
} from "@schemaforge/api-contract";
import { validateSchema } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { describePathForAi, describeSchemaForAi } from "@schemaforge/core/ai";
import type { ModelMessage } from "ai";

/** Issues listed in `<issues>`; the rest are counted in one line (plan Vấn đề 43). */
export const AI_MAX_PROMPT_ISSUES = 50;

/**
 * Cap on the escaped text of all messages, history and last user message
 * together. Escaping `<` as `&lt;` can grow text fourfold, so the raw cap
 * alone does not bound what reaches Gemini.
 */
export const AI_MAX_ESCAPED_HISTORY_LENGTH = 2 * AI_MAX_HISTORY_TEXT_LENGTH;

/** The message texts exceed `AI_MAX_ESCAPED_HISTORY_LENGTH` after escaping. */
export class AiHistoryTooLargeError extends Error {
  // A fixed message: the error never carries message content.
  constructor() {
    super("The message history of the AI prompt is too long");
    this.name = "AiHistoryTooLargeError";
  }
}

/** The schema and issues blocks exceed `AI_MAX_SCHEMA_PROMPT_LENGTH` after escaping. */
export class AiPromptTooLargeError extends Error {
  // A fixed message: the error never carries schema or message content.
  constructor() {
    super("The schema and issues blocks of the AI prompt are too long");
    this.name = "AiPromptTooLargeError";
  }
}

// Only the backend writes these lines, from `proposalOutcome` (AI-R59).
const OUTCOME_MARKERS: Readonly<Record<AiProposalOutcome, string>> = {
  accepted: "[The user accepted this proposal.]",
  discarded: "[The user discarded this proposal.]",
};
// Any whitespace run may sit between the words; no nested quantifiers.
const OUTCOME_MARKER_PATTERN = new RegExp(
  Object.values(OUTCOME_MARKERS)
    .map((marker) =>
      marker
        .split(" ")
        .map((word) => word.replace(/[.[\]]/g, "\\$&"))
        .join("\\s+"),
    )
    .join("|"),
  "giu",
);
// Every line terminator a model may read as a new line.
const LINE_BREAK = /\r\n|[\r\n\u2028\u2029\u0085\v\f]/;
const FORMAT_CHARACTERS = /\p{Cf}/gu;
// `<` is a valid JSON escape of `<`, so the block still parses to the
// same value while no data can open or close a delimiter tag (AI-R59).
const JSON_ESCAPED_LESS_THAN = "\\u003c";
const TEXT_ESCAPED_LESS_THAN = "&lt;";

// Folds fullwidth and compatibility forms and drops zero-width and other
// format characters, so a forged marker cannot hide behind them.
function normalizeLine(line: string): string {
  return line.normalize("NFKC").replace(FORMAT_CHARACTERS, "");
}

// Repeats until stable: removing one marker can join the halves of another.
function removeMarkers(text: string): string {
  let current = text;
  let next = current.replace(OUTCOME_MARKER_PATTERN, "");
  while (next !== current) {
    current = next;
    next = current.replace(OUTCOME_MARKER_PATTERN, "");
  }
  return current;
}

// A line without a marker is kept as written; a line with one keeps its
// normalized rest, or is dropped when nothing else is left.
function stripMarkersFromLine(line: string): string[] {
  const normalized = normalizeLine(line);
  const stripped = removeMarkers(normalized);
  if (stripped === normalized) {
    return [line];
  }
  return stripped.trim() === "" ? [] : [stripped];
}

/** The schema view of the prompt as JSON, before escaping (AI-R30). */
export function describeSchemaJson(document: SchemaDocument): string {
  return JSON.stringify(describeSchemaForAi(document));
}

/**
 * Removes every backend outcome marker a client wrote, anywhere in a line,
 * in any case, spacing or compatibility form (AI-R59).
 */
export function stripOutcomeMarkers(text: string): string {
  return text.split(LINE_BREAK).flatMap(stripMarkersFromLine).join("\n");
}

function escapeJson(json: string): string {
  return json.replaceAll("<", JSON_ESCAPED_LESS_THAN);
}

function escapeText(text: string): string {
  return stripOutcomeMarkers(text).replaceAll("<", TEXT_ESCAPED_LESS_THAN);
}

function describeIssuesBody(document: SchemaDocument): string {
  const issues = validateSchema(document);
  const listed = issues.slice(0, AI_MAX_PROMPT_ISSUES).map((issue) => ({
    code: issue.code,
    at: describePathForAi(document, issue.path),
  }));
  const omittedCount = issues.length - listed.length;
  const json = escapeJson(JSON.stringify(listed));
  return omittedCount > 0
    ? `${json}\n${String(omittedCount)} more issues omitted.`
    : json;
}

// Throws AiPromptTooLargeError when the escaped schema and issues blocks,
// tags included, exceed the limit (plan Vấn đề 43).
function buildContextBlocks(document: SchemaDocument): string {
  const schemaBlock = `<schema>\n${escapeJson(describeSchemaJson(document))}\n</schema>`;
  const issuesBlock = `<issues>\n${describeIssuesBody(document)}\n</issues>`;
  if (schemaBlock.length + issuesBlock.length > AI_MAX_SCHEMA_PROMPT_LENGTH) {
    throw new AiPromptTooLargeError();
  }
  return `${schemaBlock}\n${issuesBlock}`;
}

type EscapedMessage = {
  readonly message: AiChatMessage;
  readonly text: string;
};

// Throws AiHistoryTooLargeError when the escaped texts of all messages exceed
// the cap; the schema and issues blocks are checked separately.
function escapeMessages(
  messages: readonly AiChatMessage[],
): readonly EscapedMessage[] {
  const escaped = messages.map((message) => ({
    message,
    text: escapeText(message.text),
  }));
  const total = escaped.reduce((sum, { text }) => sum + text.length, 0);
  if (total > AI_MAX_ESCAPED_HISTORY_LENGTH) {
    throw new AiHistoryTooLargeError();
  }
  return escaped;
}

function wrapUserText(escapedText: string): string {
  return `<user_message>\n${escapedText}\n</user_message>`;
}

function toModelMessage({ message, text }: EscapedMessage): ModelMessage {
  if (message.role === "user") {
    return { role: "user", content: wrapUserText(text) };
  }
  return {
    role: "assistant",
    content:
      message.proposalOutcome === undefined
        ? text
        : `${text}\n${OUTCOME_MARKERS[message.proposalOutcome]}`,
  };
}

/**
 * The `messages` of `streamText` (AI-R29): history with its real roles, and
 * the schema, issues and locale only in the last user message. Throws
 * `AiHistoryTooLargeError` when the escaped message texts are too long and
 * `AiPromptTooLargeError` when the schema is too large for the prompt.
 */
export function buildAiMessages(input: {
  readonly document: SchemaDocument;
  readonly messages: readonly AiChatMessage[];
  readonly locale: AiLocale;
}): ModelMessage[] {
  const escaped = escapeMessages(input.messages);
  const history = escaped.slice(0, -1).map(toModelMessage);
  const last = escaped.at(-1);
  if (last === undefined) {
    return history;
  }
  const context = buildContextBlocks(input.document);
  const content = `${context}\n<ui_locale>${input.locale}</ui_locale>\n${wrapUserText(last.text)}`;
  return [...history, { role: "user", content }];
}
