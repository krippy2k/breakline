import { calculatePrice, type Order } from "./pricing";

export function createOrder(order: Order) {
  const price = calculatePrice(order);
  return {
    ...order,
    price,
  };
}
