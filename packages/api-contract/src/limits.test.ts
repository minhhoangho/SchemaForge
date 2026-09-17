import { describe, expect, it } from "vitest";

import {
  EMAIL_MAX_LENGTH,
  MAX_REQUEST_BODY_BYTES,
  MAX_SCHEMAS_PER_USER,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SCHEMA_LIST_DEFAULT_LIMIT,
  SCHEMA_LIST_MAX_LIMIT,
} from "./limits.js";

describe("limits", () => {
  it("keeps the limits agreed in the spec", () => {
    expect({
      EMAIL_MAX_LENGTH,
      PASSWORD_MIN_LENGTH,
      PASSWORD_MAX_LENGTH,
      MAX_REQUEST_BODY_BYTES,
      SCHEMA_LIST_DEFAULT_LIMIT,
      SCHEMA_LIST_MAX_LIMIT,
      MAX_SCHEMAS_PER_USER,
    }).toStrictEqual({
      EMAIL_MAX_LENGTH: 254,
      PASSWORD_MIN_LENGTH: 8,
      PASSWORD_MAX_LENGTH: 128,
      MAX_REQUEST_BODY_BYTES: 2_097_152,
      SCHEMA_LIST_DEFAULT_LIMIT: 50,
      SCHEMA_LIST_MAX_LIMIT: 100,
      MAX_SCHEMAS_PER_USER: 100,
    });
  });
});
