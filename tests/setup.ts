// Minimal in-memory localStorage so lib/history.ts (which reads/writes on-device
// storage) can be tested under the Node environment. Each test file gets a fresh
// store via localStorage.clear() in its own beforeEach.
class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null;
  }
}

if (!("localStorage" in globalThis)) {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}
