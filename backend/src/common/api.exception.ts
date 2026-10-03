import { HttpException } from "@nestjs/common";
import type { ApiErrorBody } from "@schemaforge/api-contract";

export type ApiExceptionOptions = {
  /** Sent as the `Retry-After` header by `ApiExceptionFilter`. */
  readonly retryAfterSeconds?: number;
};

/** Every expected failure of the API; `ApiExceptionFilter` returns `body` as is. */
export class ApiException extends HttpException {
  readonly retryAfterSeconds: number | null;

  constructor(
    readonly body: ApiErrorBody,
    options?: ApiExceptionOptions,
  ) {
    super(body, body.statusCode);
    this.retryAfterSeconds = options?.retryAfterSeconds ?? null;
  }
}
