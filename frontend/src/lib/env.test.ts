import { describe, expect, it } from "vitest";

import { readEnvironment } from "./env";

describe("readEnvironment", () => {
  it.each<[string, boolean, boolean]>([
    ["development", true, false],
    ["production", false, true],
    ["test", false, false],
  ])(
    "reads %s as the node environment",
    (nodeEnvironment, isDevelopment, isProduction) => {
      expect(readEnvironment({ NODE_ENV: nodeEnvironment })).toStrictEqual({
        nodeEnvironment,
        isDevelopment,
        isProduction,
      });
    },
  );

  it.each(["staging", undefined])(
    "throws for an unsupported NODE_ENV",
    (nodeEnvironment) => {
      expect(() => readEnvironment({ NODE_ENV: nodeEnvironment })).toThrow(
        Error,
      );
    },
  );
});
