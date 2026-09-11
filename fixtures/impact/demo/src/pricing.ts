export interface Order {
  subtotal: number;
  discount: number;
}

export function calculatePrice(order: Order) {
  return order.subtotal - order.discount;
}
