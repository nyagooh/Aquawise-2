/**
 * Demo access: the live demo opens after a visitor leaves their work email and
 * company on the Explore demo page. Remembered for the browser session.
 */
const KEY = 'aw:demo-access';

export function hasDemoAccess(): boolean {
  try { return sessionStorage.getItem(KEY) === 'granted'; } catch { return false; }
}

export function grantDemoAccess(): void {
  try { sessionStorage.setItem(KEY, 'granted'); } catch { /* ignore */ }
}
