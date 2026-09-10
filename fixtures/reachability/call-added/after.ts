export function confirm(paymentSuccessful: boolean) {
    if (paymentSuccessful) {
        createShipment();
    }

    sendConfirmation();
}

declare function createShipment(): void;
declare function sendConfirmation(): void;
