export function canCancel(status: string) {
  if (status === "pending") {
    return true;
  }
  return false;
}
