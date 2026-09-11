export function processOrder(order: string) {
  save(order, true);
}

declare function save(order: string, notify?: boolean): void;
