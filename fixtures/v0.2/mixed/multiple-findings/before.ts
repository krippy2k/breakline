export function processOrder(status: string) {
  if (status === "pending") {
    save(status);
    return true;
  }
  return false;
}

declare function save(status: string): void;
