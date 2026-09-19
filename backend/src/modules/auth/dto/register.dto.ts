import type { RegisterRequest } from "@schemaforge/api-contract";

import { CredentialsDto } from "./credentials.dto.js";

export class RegisterDto extends CredentialsDto implements RegisterRequest {}
