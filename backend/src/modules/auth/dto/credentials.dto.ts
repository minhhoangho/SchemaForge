import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@schemaforge/api-contract";
import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

import { normalizeEmail } from "../../../common/normalize-email.js";

/**
 * Shared body of register and login. The password length is checked again in
 * code points after NFKC by `AuthService` (spec section 2).
 */
export class CredentialsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  readonly email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  readonly password!: string;
}
