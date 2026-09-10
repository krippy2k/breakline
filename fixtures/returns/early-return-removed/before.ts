export function process(valid: boolean) {
    if (!valid) {
        return false;
    }

    doWork();
    return true;
}

function doWork() {}
