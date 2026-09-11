export function processOrder(order: string) {
  save(order);
}

declare function save(order: string): void;
