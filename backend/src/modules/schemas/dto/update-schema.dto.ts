import type { UpdateSchemaRequest } from "@schemaforge/api-contract";
import { IsInt, IsObject, Min } from "class-validator";

const MIN_REVISION = 1;

/** `PUT` replaces the whole document, so both fields are required (no `PartialType`). */
export class UpdateSchemaDto implements UpdateSchemaRequest {
  @IsObject()
  readonly document!: unknown;

  @IsInt()
  @Min(MIN_REVISION)
  readonly expectedRevision!: number;
}
