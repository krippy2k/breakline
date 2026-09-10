export function remove(authorized: boolean) {
    if (authorized) {
        deleteAccount();
    }
}

declare function deleteAccount(): void;
