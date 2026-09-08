import { describe, it, expect, beforeEach } from "vitest";
import {
  sessionSig,
  loadRecent,
  loadFavs,
  pushRecent,
  isFav,
  toggleFav,
  removeRecent,
  removeFav,
  type RecentSession,
} from "@/lib/history";

beforeEach(() => localStorage.clear());

function make(over: Partial<RecentSession> = {}): RecentSession {
  return {
    context: "meditation",
    label: "Meditation",
    sub: "10 min · Ocean Waves",
    duration: 10,
    voice: "female",
    accent: "us",
    soundscape: "ocean",
    at: Date.now(),
    ...over,
  };
}

describe("sessionSig", () => {
  it("is identical for the same choices and differs when any choice changes", () => {
    const a = make();
    expect(sessionSig(a)).toBe(sessionSig(make({ at: a.at + 5000, label: "x" })));
    expect(sessionSig(a)).not.toBe(sessionSig(make({ soundscape: "rain" })));
    expect(sessionSig(a)).not.toBe(sessionSig(make({ duration: 20 })));
    expect(sessionSig(a)).not.toBe(sessionSig(make({ customText: "calm my nerves" })));
  });
});

describe("pushRecent", () => {
  it("puts the newest first and de-duplicates by signature", () => {
    pushRecent(make({ soundscape: "rain" }));
    pushRecent(make({ soundscape: "ocean" }));
    const list = pushRecent(make({ soundscape: "rain" })); // replay of the first
    expect(list).toHaveLength(2);
    expect(list[0].soundscape).toBe("rain"); // floated back to the top
  });

  it("caps the rolling window at 10", () => {
    let list: RecentSession[] = [];
    for (let i = 0; i < 15; i++) list = pushRecent(make({ duration: i }));
    expect(list).toHaveLength(10);
    expect(loadRecent()).toHaveLength(10);
    // The 10 most recent survive (durations 14..5).
    expect(list[0].duration).toBe(14);
    expect(list[9].duration).toBe(5);
  });
});

describe("favorites", () => {
  it("toggles a session in and out of saved", () => {
    const s = make({ soundscape: "harp" });
    expect(isFav(loadFavs(), s)).toBe(false);
    let favs = toggleFav(s);
    expect(isFav(favs, s)).toBe(true);
    favs = toggleFav(s);
    expect(isFav(favs, s)).toBe(false);
    expect(loadFavs()).toHaveLength(0);
  });

  it("keeps saved sessions independent of the recent cap", () => {
    const saved = make({ soundscape: "piano", duration: 30 });
    toggleFav(saved);
    for (let i = 0; i < 15; i++) pushRecent(make({ duration: i }));
    // The favorite persists even though 15 recents rolled through.
    expect(isFav(loadFavs(), saved)).toBe(true);
  });
});

describe("removal", () => {
  it("removeRecent and removeFav delete only the matching session", () => {
    const keep = make({ soundscape: "rain" });
    const drop = make({ soundscape: "ocean" });
    pushRecent(keep);
    pushRecent(drop);
    const afterR = removeRecent(drop);
    expect(afterR).toHaveLength(1);
    expect(afterR[0].soundscape).toBe("rain");

    toggleFav(keep);
    toggleFav(drop);
    const afterF = removeFav(drop);
    expect(afterF.some((f) => sessionSig(f) === sessionSig(drop))).toBe(false);
    expect(afterF.some((f) => sessionSig(f) === sessionSig(keep))).toBe(true);
  });
});
