import { type CustomDecorator, SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Opts a route out of the global authentication guard. `OriginGuard` still applies. */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
