// Zod schemas are created when this module loads. In the browser it must load
// after frontend/src/lib/zod-config.ts (Zod jitless), like the core package.
import { z } from "zod";

export type RegisterRequest = {
  readonly email: string;
  readonly password: string;
};

export type LoginRequest = {
  readonly email: string;
  readonly password: string;
};

export const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  createdAt: z.iso.datetime(),
});

export type UserResponse = Readonly<z.infer<typeof userResponseSchema>>;

// Body of register, login and me.
export const authUserResponseSchema = z.object({ user: userResponseSchema });

export type AuthUserResponse = Readonly<z.infer<typeof authUserResponseSchema>>;
