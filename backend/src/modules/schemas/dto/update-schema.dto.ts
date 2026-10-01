import type { UpdateSchemaRequest } from "@schemaforge/api-contract";
import { IsInt, IsObject, Min } from "class-validator";

import { RawValue } from "../../../common/raw-value.decorator.js";

const MIN_REVISION = 1;

/** `PUT` replaces the whole document, so both fields are required (no `PartialType`). */
export class UpdateSchemaDto implements UpdateSchemaRequest {
  @IsObject()
  @RawValue()
  readonly document!: unknown;

  @IsInt()
  @Min(MIN_REVISION)
  readonly expectedRevision!: number;
}
