import { describe, expect, it } from "vitest";
import {
  DAILY_MAX_ML,
  QUICK_WINDOW_MAX_ML,
  addRealPlant,
  buyPlant,
  computeLongestStreak,
  computeStreak,
  coinsFor,
  daysUntilNextWater,
  defaultState,
  logWater,
  refreshStreak,
  removeRealPlant,
  shiftKey,
  todayKey,
  waterRealPlant,
  type AppState
} from "@/lib/state";
import { PLANT_SETS } from "@/lib/plants";

const MIN = 60_000;
const HOUR = 60 * MIN;
const now = Date.now();

/** Log successfully or fail loudly — keeps the arrange step readable. */
function log(state: AppState, ml: number, at = now): AppState {
  const r = logWater(state, ml, at);
  if (!r.ok) throw new Error(`expected ok, got: ${r.msg}`);
  return r.state;
}

describe("coins", () => {
  it("pays 500 per 100 mL", () => {
    expect(coinsFor(100)).toBe(500);
    expect(coinsFor(250)).toBe(1250);
  });
});

describe("logWater validation", () => {
  it("rejects tiny, huge, future and unparseable entries", () => {
    expect(logWater(defaultState(), 5, now).ok).toBe(false);
    expect(logWater(defaultState(), 1600, now).ok).toBe(false);
    expect(logWater(defaultState(), 250, now + 10 * MIN).ok).toBe(false);
    expect(logWater(defaultState(), 250, NaN).ok).toBe(false);
  });

  it("accepts a normal drink and pays out", () => {
    const r = logWater(defaultState(), 250, now);
    expect(r.ok && r.earned).toBe(1250);
    expect(r.ok && r.state.coins).toBe(1250);
    expect(r.ok && r.state.totalMlLogged).toBe(250);
  });
});

describe("safety caps", () => {
  it("enforces the daily maximum", () => {
    // Seeded directly: spreading real check-ins across a day would cross
    // midnight depending on when the suite runs.
    const s: AppState = { ...defaultState(), history: { [todayKey()]: DAILY_MAX_ML - 100 } };
    expect(logWater(s, 100, now).ok).toBe(true); // exactly fills the cap
    const r = logWater(s, 200, now); // one sip too far
    expect(r.ok).toBe(false);
    expect(!r.ok && r.msg).toMatch(/Daily safe limit/);
  });

  it("enforces the 10-minute window", () => {
    const s = log(defaultState(), 500, now);
    const r = logWater(s, 500, now);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.msg).toMatch(/Slow down/);
    expect(QUICK_WINDOW_MAX_ML).toBe(800);
  });

  it("cannot be bypassed by backdating clustered drinks", () => {
    const s = log(defaultState(), 500, now - HOUR);
    // Same 10-minute span, just moved into the past.
    expect(logWater(s, 500, now - HOUR + 3 * MIN).ok).toBe(false);
  });

  it("still allows drinks that are genuinely spaced out", () => {
    const s = log(defaultState(), 500, now - HOUR);
    expect(logWater(s, 500, now - 20 * MIN).ok).toBe(true);
  });
});

describe("backdated logging", () => {
  it("files the drink under the date it was drunk", () => {
    const yesterday = shiftKey(todayKey(), -1);
    const s = log(defaultState(), 250, now - 26 * HOUR);
    expect(s.history[yesterday]).toBe(250);
    expect(s.history[todayKey()]).toBeUndefined();
  });

  it("keeps check-ins newest-first", () => {
    let s = defaultState();
    s = log(s, 100, now - 5 * MIN);
    s = log(s, 100, now - 90 * MIN);
    s = log(s, 100, now - 45 * MIN);
    const ts = s.checkins.map((c) => c.ts);
    expect([...ts].sort((a, b) => b - a)).toEqual(ts);
  });
});

describe("streaks", () => {
  const day = (n: number) => shiftKey(todayKey(), -n);

  it("counts consecutive days ending today", () => {
    expect(computeStreak({ [day(0)]: true, [day(1)]: true, [day(2)]: true })).toBe(3);
  });

  it("survives today being unfinished", () => {
    expect(computeStreak({ [day(1)]: true, [day(2)]: true })).toBe(2);
  });

  it("breaks when a whole day was missed", () => {
    expect(computeStreak({ [day(2)]: true, [day(3)]: true })).toBe(0);
  });

  it("finds the longest historical run", () => {
    expect(computeLongestStreak({ [day(9)]: true, [day(5)]: true, [day(4)]: true, [day(3)]: true }))
      .toBe(3);
  });

  it("heals a gap when an earlier day is completed retroactively", () => {
    // Goal met today and two days ago, with the day between still missing.
    let s: AppState = { ...defaultState(), goalMl: 500 };
    s = log(s, 500, now - 2 * 24 * HOUR);
    s = log(s, 500, now);
    expect(refreshStreak(s).streak).toBe(1);

    // Fill the hole — the run should now span all three days.
    s = log(s, 500, now - 24 * HOUR);
    expect(s.streak).toBe(3);
    expect(s.longestStreak).toBe(3);
  });

  it("reports the day a retroactive goal belongs to", () => {
    const s: AppState = { ...defaultState(), goalMl: 500 };
    const r = logWater(s, 500, now - 26 * HOUR);
    expect(r.ok && r.goalHit).toBe(true);
    expect(r.ok && r.day).toBe(shiftKey(todayKey(), -1));
  });
});

describe("shop", () => {
  const first = PLANT_SETS[0].plants[0];

  it("refuses when coins are short", () => {
    expect(buyPlant(defaultState(), first.id).ok).toBe(false);
  });

  it("buys, debits and records ownership", () => {
    const rich: AppState = { ...defaultState(), coins: 100_000 };
    const r = buyPlant(rich, first.id);
    expect(r.ok).toBe(true);
    expect(r.ok && r.state.coins).toBe(100_000 - first.price);
    expect(r.ok && !!r.state.owned[first.id]).toBe(true);
  });

  it("locks set 2 until set 1 is complete, then unlocks it", () => {
    let s: AppState = { ...defaultState(), coins: 1_000_000 };
    expect(buyPlant(s, PLANT_SETS[1].plants[0].id).ok).toBe(false);
    for (const p of PLANT_SETS[0].plants) {
      const r = buyPlant(s, p.id);
      if (r.ok) s = r.state;
    }
    expect(buyPlant(s, PLANT_SETS[1].plants[0].id).ok).toBe(true);
  });

  it("flags the set as complete on the final purchase", () => {
    let s: AppState = { ...defaultState(), coins: 1_000_000 };
    const plants = PLANT_SETS[0].plants;
    plants.slice(0, -1).forEach((p) => {
      const r = buyPlant(s, p.id);
      if (r.ok) s = r.state;
    });
    const last = buyPlant(s, plants[plants.length - 1].id);
    expect(last.ok && last.setCompleted?.id).toBe(1);
  });
});

describe("real plants", () => {
  it("adds, waters and removes", () => {
    const added = addRealPlant(defaultState(), "Fern", "Boston", 3);
    expect(added).not.toBeNull();
    const s = added as AppState;
    expect(s.realPlants).toHaveLength(1);
    expect(daysUntilNextWater(s.realPlants[0])).toBe(-1); // never watered = due

    const watered = waterRealPlant(s, s.realPlants[0].id);
    expect(watered?.state.realPlants[0].lastWatered).toBeTypeOf("number");
    expect(daysUntilNextWater(watered!.state.realPlants[0])).toBe(3);

    expect(removeRealPlant(s, s.realPlants[0].id).realPlants).toHaveLength(0);
  });

  it("pays the photo bonus once per day", () => {
    const s = addRealPlant(defaultState(), "Fern", "", 7) as AppState;
    const id = s.realPlants[0].id;
    const shot = { id: "m-1", type: "image/jpeg", name: "fern.jpg", size: 1024 };
    const first = waterRealPlant(s, id, shot)!;
    expect(first.state.coins).toBe(1000);
    const second = waterRealPlant(first.state, id, shot)!;
    expect(second.state.coins).toBe(1000); // unchanged
    expect(second.msg).toMatch(/already claimed/);
  });

  it("rejects a blank name", () => {
    expect(addRealPlant(defaultState(), "   ", "", 7)).toBeNull();
  });
});
