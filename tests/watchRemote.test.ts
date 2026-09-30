import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  watchAvailable,
  pushWatchState,
  clearWatchState,
  onWatchCommand,
  _resetForTests,
  type WatchState,
} from "@/lib/watchRemote";

const base: WatchState = {
  active: true,
  playing: true,
  title: "Your session",
  soundscape: "Rain on leaves",
  remaining: 300,
  total: 300,
};

function setBridge(bridge: any) {
  (globalThis as any).window = { Capacitor: { Plugins: { WatchBridge: bridge } } };
}

afterEach(() => {
  delete (globalThis as any).window;
  _resetForTests();
});

describe("watchRemote without a native bridge", () => {
  beforeEach(() => {
    delete (globalThis as any).window;
    _resetForTests();
  });

  it("reports unavailable and never throws", () => {
    expect(watchAvailable()).toBe(false);
    expect(() => pushWatchState(base)).not.toThrow();
    expect(() => clearWatchState()).not.toThrow();
  });

  it("onWatchCommand returns a no-op unsubscriber", () => {
    const off = onWatchCommand(() => {});
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
  });
});

describe("watchRemote with a native bridge", () => {
  beforeEach(() => {
    _resetForTests();
  });

  it("is available and forwards state to the plugin", () => {
    const updateState = vi.fn();
    setBridge({ updateState });
    expect(watchAvailable()).toBe(true);
    pushWatchState(base);
    expect(updateState).toHaveBeenCalledTimes(1);
    expect(updateState).toHaveBeenCalledWith(base);
  });

  it("dedupes identical snapshots but sends when a field changes", () => {
    const updateState = vi.fn();
    setBridge({ updateState });
    pushWatchState(base);
    pushWatchState({ ...base }); // identical -> skipped
    expect(updateState).toHaveBeenCalledTimes(1);
    pushWatchState({ ...base, remaining: 299 }); // changed -> sent
    expect(updateState).toHaveBeenCalledTimes(2);
  });

  it("clearWatchState sends an inactive snapshot and resets dedupe", () => {
    const updateState = vi.fn();
    setBridge({ updateState });
    pushWatchState(base);
    clearWatchState();
    expect(updateState).toHaveBeenLastCalledWith(
      expect.objectContaining({ active: false, playing: false })
    );
    // After a clear, the same active snapshot sends again (not deduped away).
    pushWatchState(base);
    expect(updateState).toHaveBeenCalledTimes(3);
  });

  it("routes only valid commands from the plugin to the handler", () => {
    let cb: ((data: any) => void) | undefined;
    const remove = vi.fn();
    setBridge({
      updateState: vi.fn(),
      addListener: (_evt: string, fn: (data: any) => void) => {
        cb = fn;
        return { remove };
      },
    });
    const handler = vi.fn();
    const off = onWatchCommand(handler);
    cb?.({ action: "pause" });
    cb?.({ action: "bogus" }); // ignored
    cb?.({ action: "stop" });
    expect(handler.mock.calls.map((c) => c[0])).toEqual(["pause", "stop"]);
    off();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
