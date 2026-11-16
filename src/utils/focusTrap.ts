/**
 * Where Tab should go inside a modal: wraps from the last control to the first
 * (and back with Shift), and pulls focus back in when it has left the dialog.
 * Returns null when the browser's default move stays inside.
 */
export function trappedFocusTarget<T>(
  focusable: readonly T[],
  active: T | null,
  shiftKey: boolean
): T | null {
  if (focusable.length === 0) return null;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const inside = active !== null && focusable.includes(active);
  if (!inside) return shiftKey ? last : first;
  if (shiftKey && active === first) return last;
  if (!shiftKey && active === last) return first;
  return null;
}
