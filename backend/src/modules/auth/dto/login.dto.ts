import type { LoginRequest } from "@schemaforge/api-contract";

import { CredentialsDto } from "./credentials.dto.js";

export class LoginDto extends CredentialsDto implements LoginRequest {}
