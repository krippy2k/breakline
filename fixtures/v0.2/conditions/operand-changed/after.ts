export function canCancel(status: string) {
  if (status !== "shipped") {
    return true;
  }
  return false;
}
