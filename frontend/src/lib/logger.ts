const LOG_PREFIX = "[schemaforge]";

export type LogValue = string | number | boolean | readonly (string | number)[];

/**
 * Only pass error codes, operation types, document paths and error names.
 * Never pass schema names, comments or any other schema content, because logs
 * can be read by anyone with access to the browser console.
 *
 * The path type is a generic array rather than `DocumentPath` because this
 * module must not depend on `@schemaforge/core`.
 */
export type LogFields = Readonly<Record<string, LogValue>>;

export type LogSink = Pick<Console, "error" | "warn">;

export type Logger = {
  readonly error: (event: string, fields?: LogFields) => void;
  readonly warn: (event: string, fields?: LogFields) => void;
};

export function createLogger(sink: LogSink): Logger {
  return {
    error: (event, fields) => {
      sink.error(LOG_PREFIX, event, fields ?? {});
    },
    warn: (event, fields) => {
      sink.warn(LOG_PREFIX, event, fields ?? {});
    },
  };
}

// The only place in the app that touches the console: every other module logs
// through this logger.
export const logger: Logger = createLogger(console);
