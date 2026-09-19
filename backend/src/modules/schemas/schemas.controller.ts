import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import type {
  SchemaDetail,
  SchemaList,
  SchemaSummary,
} from "@schemaforge/api-contract";

import {
  type AuthenticatedUser,
  CurrentUser,
} from "../../common/current-user.decorator.js";
import { CreateSchemaDto } from "./dto/create-schema.dto.js";
import { ListSchemasQueryDto } from "./dto/list-schemas-query.dto.js";
import { UpdateSchemaDto } from "./dto/update-schema.dto.js";
import { SchemasService } from "./schemas.service.js";

/** Private by default: no handler here opts out with `@Public()`. */
@Controller("schemas")
export class SchemasController {
  constructor(private readonly schemasService: SchemasService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSchemasQueryDto,
  ): Promise<SchemaList> {
    return this.schemasService.list(user.userId, query);
  }

  @Get(":id")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SchemaDetail> {
    return this.schemasService.get(user.userId, id);
  }

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSchemaDto,
  ): Promise<SchemaSummary> {
    return this.schemasService.create(user.userId, dto);
  }

  @Put(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchemaDto,
  ): Promise<SchemaSummary> {
    return this.schemasService.update(user.userId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.schemasService.remove(user.userId, id);
  }
}
