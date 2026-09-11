import { createOrder } from "./checkout-service";

export function checkout(req: { body: { subtotal: number; discount: number } }, res: { json: (value: unknown) => void }) {
  const order = createOrder(req.body);
  res.json(order);
}

export function mount(app: { post: (path: string, handler: unknown) => void }) {
  app.post("/checkout", checkout);
}
