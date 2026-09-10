export async function checkout() {
    try {
        await charge();
    } catch (err) {
        logger.error(err);
    }

    createShipment();
}

declare function charge(): Promise<void>;
declare const logger: { error(err: unknown): void };
declare function createShipment(): void;
