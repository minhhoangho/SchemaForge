export type Result<T, E> =
  | { readonly isOk: true; readonly value: T }
  | { readonly isOk: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { isOk: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { isOk: false, error };
}
