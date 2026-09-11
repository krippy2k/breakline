import { calculatePrice } from "../src/pricing";

it("calculates price", () => {
  calculatePrice({ subtotal: 10, discount: 1 });
});
