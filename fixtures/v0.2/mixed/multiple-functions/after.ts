export function scale(value: number) {
  return value * 2;
}

export function allowed(ok: boolean) {
  if (!ok) {
    return true;
  }
  return false;
}
