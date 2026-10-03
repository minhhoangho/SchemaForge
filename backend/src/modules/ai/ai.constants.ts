// Model call constants of the AI spec section 6 ("Model và tham số"). Kept in
// code, not env, like `RATE_LIMIT_POLICIES`.

/** Steps of the tool loop per turn (`stopWhen: isStepCount`, AI-R19). */
export const AI_MAX_STEPS = 8;
/** Output tokens per step. */
export const AI_MAX_OUTPUT_TOKENS = 8192;
/** The client waits up to 120 seconds (AI-R25). */
export const AI_TIMEOUT = { totalMs: 90_000, stepMs: 45_000 } as const;
/** `Retry-After` of the `429` sent while the user already has a turn running (AI-R56). */
export const AI_BUSY_RETRY_AFTER_SECONDS = 10;
/** Maximum JSON size of a `data-proposal` part (AI-R62). */
export const AI_MAX_PROPOSAL_BYTES = 1024 * 1024;
/** Each retry is billed again, so the AI SDK retries a transient failure once. */
export const AI_MAX_RETRIES = 1;
/** Tool calls of any tool per turn (AI-R19). */
export const AI_MAX_TOOL_CALLS_PER_TURN = 30;
/** Error entries returned to the model for one tool call. */
export const AI_MAX_TOOL_ERRORS_PER_CALL = 5;
/** Window of the global budget `AI_GLOBAL_REQUESTS_PER_HOUR` (AI-R55). */
export const AI_GLOBAL_BUDGET_WINDOW_SECONDS = 3600;
