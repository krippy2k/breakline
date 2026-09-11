export function fail(reason: string) {
  log(reason);
  throw new Error(reason);
}

declare function log(reason: string): void;
