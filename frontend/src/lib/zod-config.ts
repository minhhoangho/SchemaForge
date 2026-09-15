import { z } from "zod";

// Zod 4 compiles object parsers with `new Function`, which the nonce-based CSP
// blocks as eval. Zod reads `jitless` when a schema is created, not when it
// parses, and core creates its schemas on import, so this module must load
// before @schemaforge/core and every other module that creates Zod schemas.
// Zod keeps this setting on globalThis.__zod_globalConfig, so it also applies
// to the Zod copy that core uses.
z.config({ jitless: true });
