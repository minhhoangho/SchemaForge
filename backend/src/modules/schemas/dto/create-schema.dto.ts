import type { CreateSchemaRequest } from "@schemaforge/api-contract";
import { IsObject, IsUUID } from "class-validator";

import { RawValue } from "../../../common/raw-value.decorator.js";

/** The document structure is checked by `@schemaforge/core`, not by class-validator. */
export class CreateSchemaDto implements CreateSchemaRequest {
  @IsUUID()
  readonly id!: string;

  @IsObject()
  @RawValue()
  readonly document!: unknown;
}
