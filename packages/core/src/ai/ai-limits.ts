import { MAX_NAME_BYTES } from "../model/name-limits.js";

// A name longer than 63 characters is surely over 63 bytes; core's byte rule
// still runs on the translated operation.
export const AI_MAX_NAME_LENGTH = MAX_NAME_BYTES;
export const AI_MAX_COMMENT_LENGTH = 1000;
export const AI_MAX_DEFAULT_VALUE_LENGTH = 500;
export const AI_MAX_ENUM_VALUES = 100;
export const AI_MAX_CREATE_TABLE_COLUMNS = 100;
export const AI_MAX_COLUMN_NAME_LIST = 16;
export const AI_MAX_FINDING_TITLE_LENGTH = 200;
export const AI_MAX_FINDING_DETAIL_LENGTH = 2000;
// The next three equal the api-contract limits of the same name: core cannot
// import api-contract, and a backend test asserts both copies match.
export const AI_MAX_FINDINGS = 30;
export const AI_MAX_SAMPLE_ROWS_PER_TABLE = 20;
export const AI_MAX_SAMPLE_ROWS_PER_TURN = 200;
export const AI_MAX_SAMPLE_TABLES = 100;
// Column and value pairs in one sample row.
export const AI_MAX_SAMPLE_KEYS_PER_ROW = 100;
export const AI_MAX_SAMPLE_STRING_LENGTH = 2000;
export const AI_MAX_SAMPLE_INPUT_BYTES = 256 * 1024;
// Nesting depth of a JSON column value, measured after parsing (primitive = depth 0).
export const AI_MAX_SAMPLE_DEPTH = 4;
