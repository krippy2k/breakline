export function processOrder(status: string) {
  if (status !== "shipped") {
    save(status);
    auditOrder(status);
    return false;
  }
  return false;
}

declare function save(status: string): void;
declare function auditOrder(status: string): void;
