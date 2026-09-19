import {
  type ListSchemasQuery,
  SCHEMA_LIST_DEFAULT_LIMIT,
  SCHEMA_LIST_MAX_LIMIT,
} from "@schemaforge/api-contract";
import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const MIN_LIMIT = 1;
const CURSOR_MAX_LENGTH = 200;

export class ListSchemasQueryDto implements ListSchemasQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_LIMIT)
  @Max(SCHEMA_LIST_MAX_LIMIT)
  readonly limit: number = SCHEMA_LIST_DEFAULT_LIMIT;

  @IsOptional()
  @IsString()
  @MaxLength(CURSOR_MAX_LENGTH)
  readonly cursor?: string;
}
