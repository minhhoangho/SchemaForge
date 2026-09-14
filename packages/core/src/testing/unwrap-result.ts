import type { Result } from "../result.js";

export function unwrapOk<T, E>(result: Result<T, E>): T {
  if (!result.isOk) {
    throw new Error(`Expected an ok result but got: ${JSON.stringify(result)}`);
  }
  return result.value;
}

export function unwrapError<T, E>(result: Result<T, E>): E {
  if (result.isOk) {
    throw new Error(
      `Expected an error result but got: ${JSON.stringify(result)}`,
    );
  }
  return result.error;
}
