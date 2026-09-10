export function canRetry(retries: number) {
    if (retries < 3) {
        return true;
    }

    return false;
}
