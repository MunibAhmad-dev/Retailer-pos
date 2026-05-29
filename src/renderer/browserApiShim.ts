// src/renderer/browserApiShim.ts
// ─────────────────────────────────────────────────────────────────────────────
// Browser-compatible replacement for window.api.
//
// When the app is opened in a plain browser (e.g. via Cloudflare tunnel for
// testing), the Electron preload script never runs, so window.api is undefined.
// App.tsx injects this shim at module-load time when it detects that case.
//
// Every call to window.api.someMethod(...args) is translated into:
//   POST /api/invoke  { channel: 'some-method', args: [...args] }
// which Vite dev-server proxies to Electron's built-in HTTP bridge on port 3001.
//
// Naming convention: camelCase → kebab-case (matches ipcMain channel names)
//   getProducts       → get-products
//   getDashboardStats → get-dashboard-stats
//   isActivated       → is-activated
//
// IPC event subscriptions (onToggleLicenseIssuer, onAutoExportComplete, etc.)
// have no equivalent in a plain browser; they return a no-op unsubscribe fn.
// ─────────────────────────────────────────────────────────────────────────────

async function invoke(channel: string, ...args: any[]): Promise<any> {
  const res = await fetch('/api/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, args }),
  });
  if (!res.ok) throw new Error(`API bridge returned HTTP ${res.status}`);
  return res.json();
}

/** camelCase → kebab-case  e.g. getProducts → get-products */
function toKebab(name: string): string {
  return name.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

/** Returns true for IPC push-subscription methods like onToggleLicenseIssuer */
function isSub(name: string): boolean {
  return /^on[A-Z]/.test(name);
}

export const browserApi: any = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (typeof prop !== 'string') return undefined;
      // Don't intercept Promise protocol or React's internal symbol checks
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;

      // IPC subscription methods (onXxx) have no browser equivalent — no-op
      if (isSub(prop)) {
        return (_callback: any) => () => {};
      }

      const channel = toKebab(prop);
      return (...args: any[]) => invoke(channel, ...args);
    },
  }
);
