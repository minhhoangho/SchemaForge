import type { CreateSchemaRequest } from "@schemaforge/api-contract";
import { IsObject, IsUUID } from "class-validator";

/** The document structure is checked by `@schemaforge/core`, not by class-validator. */
export class CreateSchemaDto implements CreateSchemaRequest {
  @IsUUID()
  readonly id!: string;

  @IsObject()
  readonly document!: unknown;
}
