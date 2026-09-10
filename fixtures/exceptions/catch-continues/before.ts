export async function checkout() {
    try {
        await charge();
    } catch (err) {
        return failed();
    }

    createShipment();
}

declare function charge(): Promise<void>;
declare function failed(): boolean;
declare function createShipment(): void;
