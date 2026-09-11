export function fail(reason: string) {
  log(reason);
}

declare function log(reason: string): void;
