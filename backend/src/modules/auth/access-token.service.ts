import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { Clock } from "../../common/clock.js";

export const ACCESS_TOKEN_TTL_SECONDS = 900;

const MILLISECONDS_PER_SECOND = 1000;

/** Signs the `sf-access` JWT; the secret comes from the `JwtModule` configuration. */
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly clock: Clock,
  ) {}

  sign(userId: string): Promise<string> {
    const issuedAt = Math.floor(
      this.clock.now().getTime() / MILLISECONDS_PER_SECOND,
    );
    // jsonwebtoken computes `exp` from the payload's `iat`.
    return this.jwtService.signAsync(
      { sub: userId, iat: issuedAt },
      { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
  }
}
