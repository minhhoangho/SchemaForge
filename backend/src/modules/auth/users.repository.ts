import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";

export const USER_SELECT = {
  id: true,
  email: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

export type UserRecord = Prisma.UserGetPayload<{
  select: typeof USER_SELECT;
}>;

export type UserCredentials = UserRecord & { readonly passwordHash: string };

const USER_CREDENTIALS_SELECT = {
  ...USER_SELECT,
  passwordHash: true,
} as const satisfies Prisma.UserSelect;

/**
 * The only place that touches `prisma.user`. A duplicate email surfaces as `P2002`,
 * which `ApiExceptionFilter` translates; nothing here catches Prisma errors.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    readonly email: string;
    readonly passwordHash: string;
  }): Promise<UserRecord> {
    return this.prisma.user.create({
      data: { email: data.email, passwordHash: data.passwordHash },
      select: USER_SELECT,
    });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
  }

  /** The only method that selects `passwordHash`. */
  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: USER_CREDENTIALS_SELECT,
    });
  }
}
