import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module.js";
import { SchemasController } from "./schemas.controller.js";
import { SchemasRepository } from "./schemas.repository.js";
import { SchemasService } from "./schemas.service.js";

// PrismaModule is not @Global(), so it is imported here for SchemasRepository.
@Module({
  imports: [PrismaModule],
  controllers: [SchemasController],
  providers: [SchemasService, SchemasRepository],
})
export class SchemasModule {}
