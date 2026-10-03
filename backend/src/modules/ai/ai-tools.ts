import type {
  GenerateId,
  Operation,
  SchemaDocument,
  SeedDataset,
} from "@schemaforge/core";
import type {
  AiEdit,
  AiEditError,
  AiEditInput,
  AiEditToolName,
  AiFinding,
  AiFindingsInput,
  AiSampleDataInput,
  AiTablePlacement,
  AiToolName,
} from "@schemaforge/core/ai";
import {
  AI_MAX_FINDINGS,
  aiEditToolInputShapes,
  applyAiEdit,
  buildAiFindings,
  buildAiSampleDataset,
  createAiTablePlacement,
  describeAiChanges,
  proposeSampleDataInputShape,
  reportFindingsInputShape,
} from "@schemaforge/core/ai";
import type { FlexibleSchema, Tool, ToolExecutionOptions } from "ai";

import { AI_TOOL_DESCRIPTIONS } from "./ai-tools-descriptions.js";
import {
  AI_MAX_TOOL_CALLS_PER_TURN,
  AI_MAX_TOOL_ERRORS_PER_CALL,
} from "./ai.constants.js";

/**
 * The state of one AI turn (AI-R14). It lives in the closure of that turn's
 * tools and is never shared between requests. Every execute is synchronous,
 * so the parallel tool calls of one step never interleave.
 */
export type AiTurnState = {
  readonly original: SchemaDocument;
  draft: SchemaDocument;
  readonly operations: Operation[];
  placement: AiTablePlacement;
  toolCallCount: number;
  findings: AiFinding[];
  sampleData: SeedDataset | null;
};

/* eslint-disable @typescript-eslint/naming-convention -- AI-R16 fixes the JSON key `ok` the model reads */
/** The JSON a tool returns to the model (AI-R16): names only, never ids. */
export type AiToolOutput =
  | { readonly ok: true; readonly changes: readonly string[] }
  | {
      readonly ok: false;
      readonly errors: readonly {
        readonly code: string;
        readonly at: string;
      }[];
    };
/* eslint-enable @typescript-eslint/naming-convention -- end of the AI-R16 output keys */

// The tools declare no context schema; only abortSignal is read.
type ToolExecution = ToolExecutionOptions<unknown>;

type AiToolInputs = { readonly [K in AiEditToolName]: AiEditInput<K> } & {
  readonly reportFindings: AiFindingsInput;
  readonly proposeSampleData: AiSampleDataInput;
};

/** A tool whose execute is synchronous, so callers get the output directly. */
export type AiTool<Input> = {
  readonly description: string;
  readonly inputSchema: FlexibleSchema<Input>;
  readonly execute: (input: Input, execution: ToolExecution) => AiToolOutput;
};

/** A `ToolSet` for `streamText` that keeps each tool's input type. */
export type AiToolSet = {
  readonly [K in AiToolName]: AiTool<AiToolInputs[K]>;
};

// Turn-wide errors name no element.
const TURN_AT = "";

const NO_CHANGES: AiToolOutput = { ok: true, changes: [] };

function failure(
  errors: readonly Pick<AiEditError, "code" | "at">[],
): AiToolOutput {
  return {
    ok: false,
    errors: errors
      .slice(0, AI_MAX_TOOL_ERRORS_PER_CALL)
      .map(({ code, at }) => ({ code, at })),
  };
}

function runCounted(
  state: AiTurnState,
  { abortSignal }: ToolExecution,
  run: () => AiToolOutput,
): AiToolOutput {
  // Nothing runs after the request is aborted (AI-R50).
  abortSignal?.throwIfAborted();
  // A call whose input fails the tool's shape gets its error from the AI SDK
  // without reaching execute (plan Risk 3), so it is not counted here;
  // AI_MAX_STEPS x AI_MAX_OUTPUT_TOKENS bounds those calls (plan issue 56).
  state.toolCallCount += 1;
  if (state.toolCallCount > AI_MAX_TOOL_CALLS_PER_TURN) {
    return failure([{ code: "tool-call-limit", at: TURN_AT }]);
  }
  return run();
}

function applyEdit(
  state: AiTurnState,
  edit: AiEdit,
  generateId: GenerateId,
): AiToolOutput {
  if (state.sampleData !== null) {
    return failure([{ code: "turn-has-sample-data", at: TURN_AT }]);
  }
  const before = state.draft;
  const result = applyAiEdit(before, edit, {
    generateId,
    placement: state.placement,
  });
  if (!result.isOk) {
    return failure(result.error);
  }
  const { schema, operation, placedTables } = result.value;
  state.draft = schema;
  state.operations.push(operation);
  state.placement = {
    ...state.placement,
    placedCount: state.placement.placedCount + placedTables,
  };
  return { ok: true, changes: describeAiChanges(before, schema) };
}

function reportFindings(
  state: AiTurnState,
  input: AiFindingsInput,
): AiToolOutput {
  const result = buildAiFindings(state.original, input);
  if (!result.isOk) {
    return failure(result.error);
  }
  if (state.findings.length + result.value.length > AI_MAX_FINDINGS) {
    return failure([{ code: "findings-limit", at: "findings" }]);
  }
  state.findings = [...state.findings, ...result.value];
  return NO_CHANGES;
}

function proposeSampleData(
  state: AiTurnState,
  input: AiSampleDataInput,
): AiToolOutput {
  // Sample rows are checked against the original document only (AI-R20).
  if (state.operations.length > 0) {
    return failure([{ code: "turn-has-edits", at: TURN_AT }]);
  }
  const result = buildAiSampleDataset(state.original, input);
  if (!result.isOk) {
    return failure(result.error);
  }
  state.sampleData = result.value;
  return NO_CHANGES;
}

function countedTool<Input>(
  state: AiTurnState,
  name: AiToolName,
  inputSchema: FlexibleSchema<Input>,
  run: (input: Input) => AiToolOutput,
): AiTool<Input> {
  // A plain object instead of `tool()`, an identity helper whose type widens
  // execute's result to a promise or an async iterable.
  return {
    description: AI_TOOL_DESCRIPTIONS[name],
    inputSchema,
    execute: (input, execution) =>
      runCounted(state, execution, () => run(input)),
  } satisfies Tool<Input, AiToolOutput>;
}

export function createAiTurnState(original: SchemaDocument): AiTurnState {
  return {
    original,
    draft: original,
    operations: [],
    placement: createAiTablePlacement(original),
    toolCallCount: 0,
    findings: [],
    sampleData: null,
  };
}

/**
 * The 18 tools of one turn, the only way the model changes a schema
 * (CLAUDE.md principle 4). The AI SDK checks each input against core's tool
 * shape before execute; execute then works on `state`.
 */
export function buildAiTools(
  state: AiTurnState,
  generateId: GenerateId,
): AiToolSet {
  const edit = <Input>(
    name: AiEditToolName,
    inputSchema: FlexibleSchema<Input>,
    toEdit: (input: Input) => AiEdit,
  ): AiTool<Input> =>
    countedTool(state, name, inputSchema, (input) =>
      applyEdit(state, toEdit(input), generateId),
    );
  const shapes = aiEditToolInputShapes;
  // Each entry names its tool again: a generic name cannot build the AiEdit
  // union without a cast.
  return {
    renameSchema: edit("renameSchema", shapes.renameSchema, (input) => ({
      tool: "renameSchema",
      input,
    })),
    createTable: edit("createTable", shapes.createTable, (input) => ({
      tool: "createTable",
      input,
    })),
    updateTable: edit("updateTable", shapes.updateTable, (input) => ({
      tool: "updateTable",
      input,
    })),
    removeTable: edit("removeTable", shapes.removeTable, (input) => ({
      tool: "removeTable",
      input,
    })),
    addColumn: edit("addColumn", shapes.addColumn, (input) => ({
      tool: "addColumn",
      input,
    })),
    updateColumn: edit("updateColumn", shapes.updateColumn, (input) => ({
      tool: "updateColumn",
      input,
    })),
    removeColumn: edit("removeColumn", shapes.removeColumn, (input) => ({
      tool: "removeColumn",
      input,
    })),
    setPrimaryKey: edit("setPrimaryKey", shapes.setPrimaryKey, (input) => ({
      tool: "setPrimaryKey",
      input,
    })),
    addRelation: edit("addRelation", shapes.addRelation, (input) => ({
      tool: "addRelation",
      input,
    })),
    updateRelation: edit("updateRelation", shapes.updateRelation, (input) => ({
      tool: "updateRelation",
      input,
    })),
    removeRelation: edit("removeRelation", shapes.removeRelation, (input) => ({
      tool: "removeRelation",
      input,
    })),
    addIndex: edit("addIndex", shapes.addIndex, (input) => ({
      tool: "addIndex",
      input,
    })),
    removeIndex: edit("removeIndex", shapes.removeIndex, (input) => ({
      tool: "removeIndex",
      input,
    })),
    createEnum: edit("createEnum", shapes.createEnum, (input) => ({
      tool: "createEnum",
      input,
    })),
    updateEnum: edit("updateEnum", shapes.updateEnum, (input) => ({
      tool: "updateEnum",
      input,
    })),
    removeEnum: edit("removeEnum", shapes.removeEnum, (input) => ({
      tool: "removeEnum",
      input,
    })),
    reportFindings: countedTool(
      state,
      "reportFindings",
      reportFindingsInputShape,
      (input) => reportFindings(state, input),
    ),
    proposeSampleData: countedTool(
      state,
      "proposeSampleData",
      proposeSampleDataInputShape,
      (input) => proposeSampleData(state, input),
    ),
  };
}
