export const EMAIL_MAX_LENGTH = 254;
// Counted in code points after NFKC normalization.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;
export const SCHEMA_LIST_DEFAULT_LIMIT = 50;
export const SCHEMA_LIST_MAX_LIMIT = 100;
export const MAX_SCHEMAS_PER_USER = 100;

// AI chat limits (AI spec section 5). Lengths count UTF-16 code units.
export const AI_MAX_USER_MESSAGE_LENGTH = 4000;
export const AI_MAX_MESSAGE_TEXT_LENGTH = 8000;
export const AI_MAX_MESSAGES = 40;
export const AI_MAX_HISTORY_TEXT_LENGTH = 60_000;
export const AI_MAX_SCHEMA_PROMPT_LENGTH = 80_000;
export const AI_MAX_SAMPLE_ROWS_PER_TABLE = 20;
export const AI_MAX_SAMPLE_ROWS_PER_TURN = 200;
export const AI_MAX_FINDINGS = 30;
