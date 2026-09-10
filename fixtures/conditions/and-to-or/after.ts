export function allowed(admin: boolean, active: boolean) {
    if (admin || active) {
        return true;
    }

    return false;
}
