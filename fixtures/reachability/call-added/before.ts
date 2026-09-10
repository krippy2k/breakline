export function confirm(paymentSuccessful: boolean) {
    if (paymentSuccessful) {
        createShipment();
    }
}

declare function createShipment(): void;
