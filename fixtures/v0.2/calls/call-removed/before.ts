export function processOrder(order: string) {
  save(order);
  auditOrder(order);
}

declare function save(order: string): void;
declare function auditOrder(order: string): void;
