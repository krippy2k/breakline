export function canDelete(
    isAdmin: boolean,
    isOwner: boolean
): boolean {
    if (isAdmin && isOwner) {
        return true;
    }

    return false;
}
