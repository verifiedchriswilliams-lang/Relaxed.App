// The premium entitlement: whether this device has unlocked premium (the 9
// premium soundscapes, the 10 premium voices, and infinite sessions) via the
// one-time $4.99 non-consumable IAP.
//
// Source of truth is StoreKit on the native iOS shell; this module is the thin
// client view of it. The native layer (a Capacitor plugin, wired in Xcode) tells
// the web layer the entitlement on launch / after purchase / after restore, and
// we cache it on-device so the UI is correct offline and instantly on next open.
// On the plain web there is no StoreKit, so premium stays locked (native-only
// unlock, per docs/monetization.md).
//
// Nothing here grants the entitlement on its own — purchase + restore happen
// through the native bridge. `setEntitled` only mirrors what StoreKit reports.

const KEY = "relaxed.premium.v1";

type Listener = (entitled: boolean) => void;
const listeners = new Set<Listener>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function isEntitled(): boolean {
  return read();
}

// Mirror StoreKit's verdict into the on-device cache and notify the UI. Called by
// the native bridge (on launch, purchase, or restore). Idempotent.
export function setEntitled(entitled: boolean): void {
  try {
    if (entitled) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode / blocked storage: fall back to in-memory for this session */
  }
  for (const l of listeners) l(entitled);
}

export function onEntitlementChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Capacitor bridge to the native StoreKit layer. The plugin is registered by the
// native shell; on web (or before the native plugin exists) these are no-ops and
// the entitlement simply stays whatever the cache says (locked by default).
interface PremiumPlugin {
  getEntitlement(): Promise<{ entitled: boolean }>;
  purchase(): Promise<{ entitled: boolean }>;
  restore(): Promise<{ entitled: boolean }>;
  // Fired when a transaction lands out of band (Ask to Buy, another device, a
  // refund). Optional so web / older shells don't break.
  addListener?(
    event: "entitlementChanged",
    cb: (data: { entitled: boolean }) => void
  ): unknown;
}

function nativePlugin(): PremiumPlugin | null {
  const cap = (globalThis as { Capacitor?: { Plugins?: Record<string, unknown> } })
    .Capacitor;
  const p = cap?.Plugins?.Premium as PremiumPlugin | undefined;
  return p && typeof p.purchase === "function" ? p : null;
}

export function isNativePurchaseAvailable(): boolean {
  return nativePlugin() !== null;
}

// Subscribe once to native transaction updates so out-of-band changes flip the
// UI live. No-op without the plugin.
let nativeWatchAttached = false;
function watchNativeEntitlement(): void {
  if (nativeWatchAttached) return;
  const p = nativePlugin();
  if (!p?.addListener) return;
  try {
    p.addListener("entitlementChanged", (d) => setEntitled(!!d?.entitled));
    nativeWatchAttached = true;
  } catch {
    /* ignore */
  }
}

// Ask StoreKit for the current entitlement and sync the cache. Safe to call on
// launch; no-op (keeps the cache) when there's no native plugin.
export async function refreshEntitlement(): Promise<boolean> {
  const p = nativePlugin();
  if (!p) return read();
  watchNativeEntitlement();
  try {
    const { entitled } = await p.getEntitlement();
    setEntitled(entitled);
    return entitled;
  } catch {
    return read();
  }
}

// Kick off the native purchase sheet. Resolves to the resulting entitlement.
// Rejects (or returns false) on web / when no native plugin is present — the web
// UI treats that as "get it in the app".
export async function purchasePremium(): Promise<boolean> {
  const p = nativePlugin();
  if (!p) return false;
  const { entitled } = await p.purchase();
  setEntitled(entitled);
  return entitled;
}

export async function restorePurchase(): Promise<boolean> {
  const p = nativePlugin();
  if (!p) return false;
  const { entitled } = await p.restore();
  setEntitled(entitled);
  return entitled;
}

// Dev-only: a query flag (?devUnlock=1 / ?devUnlock=0) to preview the unlocked
// UI without StoreKit. Never a user-facing control; ignored unless the flag is
// present. Returns true if it changed the entitlement.
export function applyDevUnlockFlag(): boolean {
  try {
    const v = new URLSearchParams(location.search).get("devUnlock");
    if (v === "1") {
      setEntitled(true);
      return true;
    }
    if (v === "0") {
      setEntitled(false);
      return true;
    }
  } catch {
    /* no window */
  }
  return false;
}
