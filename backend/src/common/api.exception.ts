import { HttpException } from "@nestjs/common";
import type { ApiErrorBody } from "@schemaforge/api-contract";

/** Every expected failure of the API; `ApiExceptionFilter` returns `body` as is. */
export class ApiException extends HttpException {
  constructor(readonly body: ApiErrorBody) {
    super(body, body.statusCode);
  }
}
