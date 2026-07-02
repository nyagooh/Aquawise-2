/**
 * Demo access gate.
 *
 * View-only demo mode: this is a hosted, read-only demo, so access is always
 * granted and nothing is gated behind a lead-capture form. `hasDemoAccess()`
 * unconditionally returns true; `grantDemoAccess()` is kept as a harmless
 * no-op for source compatibility.
 */
const KEY = 'aw:demo-access';

export function hasDemoAccess(): boolean {
  return true;
}

export function grantDemoAccess(): void {
  // No-op — view-only demo mode, access is always granted.
  sessionStorage.setItem(KEY, 'granted');
}
