import { AI_MAX_SCHEMA_PROMPT_LENGTH } from "@schemaforge/api-contract";
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
const NORMALIZED_OUTCOME_MARKERS: ReadonlySet<string> = new Set(
  Object.values(OUTCOME_MARKERS).map(normalizeLine),
);
const LINE_BREAK = /\r\n|\r|\n/;
// `<` is a valid JSON escape of `<`, so the block still parses to the
// same value while no data can open or close a delimiter tag (AI-R59).
const JSON_ESCAPED_LESS_THAN = "\\u003c";
const TEXT_ESCAPED_LESS_THAN = "&lt;";

function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The schema view of the prompt as JSON, before escaping (AI-R30). */
export function describeSchemaJson(document: SchemaDocument): string {
  return JSON.stringify(describeSchemaForAi(document));
}

/** Removes every line a client wrote that looks like a backend outcome marker (AI-R59). */
export function stripOutcomeMarkers(text: string): string {
  return text
    .split(LINE_BREAK)
    .filter((line) => !NORMALIZED_OUTCOME_MARKERS.has(normalizeLine(line)))
    .join("\n");
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

function wrapUserText(text: string): string {
  return `<user_message>\n${escapeText(text)}\n</user_message>`;
}

function toModelMessage(message: AiChatMessage): ModelMessage {
  if (message.role === "user") {
    return { role: "user", content: wrapUserText(message.text) };
  }
  const text = escapeText(message.text);
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
 * `AiPromptTooLargeError` when the schema is too large for the prompt.
 */
export function buildAiMessages(input: {
  readonly document: SchemaDocument;
  readonly messages: readonly AiChatMessage[];
  readonly locale: AiLocale;
}): ModelMessage[] {
  const history = input.messages.slice(0, -1).map(toModelMessage);
  const last = input.messages.at(-1);
  if (last === undefined) {
    return history;
  }
  const context = buildContextBlocks(input.document);
  const content = `${context}\n<ui_locale>${input.locale}</ui_locale>\n${wrapUserText(last.text)}`;
  return [...history, { role: "user", content }];
}
