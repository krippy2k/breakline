const REDACT = /token|authorization|secret|private|password|key/i;

export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

export function createLogger(): Logger {
  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}

function write(level: string, event: string, fields?: Record<string, unknown>): void {
  const safe: Record<string, unknown> = { level, event, time: new Date().toISOString() };
  for (const [key, value] of Object.entries(fields ?? {})) {
    safe[key] = REDACT.test(key) ? "[redacted]" : value;
  }
  process.stdout.write(`${JSON.stringify(safe)}\n`);
}
