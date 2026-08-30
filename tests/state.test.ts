import { describe, expect, it } from "vitest";
import {
  DAILY_MAX_ML,
  MAX_DURATION_MIN,
  QUICK_WINDOW_MAX_ML,
  addRealPlant,
  buyPlant,
  GROWTH_STAGES,
  computeLongestStreak,
  computeStreak,
  growthFor,
  coinsFor,
  daysBetweenKeys,
  daysUntilNextWater,
  defaultState,
  logWater,
  refreshStreak,
  removeRealPlant,
  shiftKey,
  type RealPlant,
  toSpan,
  todayKey,
  waterRealPlant,
  type AppState
} from "@/lib/state";
import { PLANT_SETS } from "@/lib/plants";
import { CONTAINERS, estimateMl, fillLabel } from "@/lib/containers";

const MIN = 60_000;
const HOUR = 60 * MIN;
const now = Date.now();

/** Log successfully or fail loudly — keeps the arrange step readable. */
function log(state: AppState, ml: number, at = now, durationMin = 0): AppState {
  const r = logWater(state, ml, at, durationMin);
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

describe("rate cap window maths", () => {
  it("allows a fill-in between two drinks no window can hold together", () => {
    // 400 mL at -69 min and -51 min: 18 min apart, so no 10-minute window
    // contains both. Adding 200 in the middle peaks at 600 mL.
    let s = log(defaultState(), 400, now - 69 * MIN);
    s = log(s, 400, now - 51 * MIN);
    expect(logWater(s, 200, now - 60 * MIN).ok).toBe(true);
  });

  it("still blocks three drinks that do share one window", () => {
    let s = log(defaultState(), 400, now - 60 * MIN);
    s = log(s, 300, now - 55 * MIN);
    // -60, -55 and -51 all sit inside a 9-minute span: 900 mL.
    expect(logWater(s, 200, now - 51 * MIN).ok).toBe(false);
  });

  it("treats exactly ten minutes as inside the window", () => {
    const s = log(defaultState(), 500, now - 70 * MIN);
    expect(logWater(s, 400, now - 60 * MIN).ok).toBe(false); // 900 mL in 10 min
  });

  it("catches a violation created by slotting a drink between two others", () => {
    let s = log(defaultState(), 500, now - 70 * MIN);
    s = log(s, 200, now - 62 * MIN); // 8 min apart, 700 mL — fine
    // The same 8-minute window now holds 900 mL.
    expect(logWater(s, 200, now - 66 * MIN).ok).toBe(false);
  });
});

describe("drinking period", () => {
  it("blocks a big volume downed in one go", () => {
    expect(logWater(defaultState(), 900, now, 0).ok).toBe(false);
  });

  it("allows the same volume sipped over an hour", () => {
    // 900 mL across 60 min = 150 mL in any 10-minute window.
    const r = logWater(defaultState(), 900, now, 60);
    expect(r.ok).toBe(true);
    expect(r.ok && r.checkin.durationMin).toBe(60);
  });

  it("still blocks a volume too big for its period", () => {
    // 900 mL over 10 min is the whole lot inside one window.
    expect(logWater(defaultState(), 900, now, 10).ok).toBe(false);
  });

  it("counts only the overlapping share of a sipped drink", () => {
    // 600 over 30 min = 200 per 10 min; a 650 gulp right after fits.
    const s = log(defaultState(), 600, now - 30 * MIN, 30);
    expect(logWater(s, 650, now, 0).ok).toBe(true);
    // But 900 on top of that overlapping share does not.
    expect(logWater(s, 900, now, 0).ok).toBe(false);
  });

  it("treats a drink as ending at the logged time", () => {
    const r = logWater(defaultState(), 300, now, 20);
    expect(r.ok).toBe(true);
    const span = toSpan(r.ok ? r.checkin : { ts: 0, ml: 0 });
    expect(span.end).toBe(now);
    expect(span.start).toBe(now - 20 * MIN);
  });

  it("clamps absurd periods", () => {
    const r = logWater(defaultState(), 500, now, 99999);
    expect(r.ok && r.checkin.durationMin).toBe(MAX_DURATION_MIN);
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

describe("growth", () => {
  const day = (n: number) => shiftKey(todayKey(), -n);
  const planted = Date.now() - 30 * 24 * HOUR;

  it("starts every new plant as a seedling", () => {
    const s: AppState = { ...defaultState(), goalDays: {} };
    const g = growthFor(s, Date.now());
    expect(g.index).toBe(0);
    expect(g.name).toBe("Seedling");
    expect(g.toNext).toBe(1);
  });

  it("advances a stage per goal day, not per calendar day", () => {
    const goalDays = { [day(1)]: true, [day(2)]: true, [day(3)]: true } as Record<string, true>;
    const s: AppState = { ...defaultState(), goalDays };
    // Three goal days over a month of ownership -> "Growing", not "Blooming".
    expect(growthFor(s, planted).days).toBe(3);
    expect(growthFor(s, planted).name).toBe("Growing");
  });

  it("does not credit a goal already met on the day of purchase", () => {
    // Goal hit today, plant bought today -> still a seedling tomorrow morning.
    const s: AppState = { ...defaultState(), goalDays: { [day(0)]: true } };
    expect(growthFor(s, Date.now()).days).toBe(0);
    expect(growthFor(s, Date.now()).name).toBe("Seedling");
  });

  it("ignores goal days from before the plant was bought", () => {
    const goalDays = { [day(20)]: true, [day(1)]: true } as Record<string, true>;
    const s: AppState = { ...defaultState(), goalDays };
    const boughtYesterday = Date.now() - 2 * 24 * HOUR;
    expect(growthFor(s, boughtYesterday).days).toBe(1);
  });

  it("tops out at the final stage", () => {
    const goalDays: Record<string, true> = {};
    for (let i = 1; i <= 25; i++) goalDays[day(i)] = true;
    const s: AppState = { ...defaultState(), goalDays };
    const g = growthFor(s, planted);
    expect(g.index).toBe(GROWTH_STAGES.length - 1);
    expect(g.name).toBe("Blooming");
    expect(g.toNext).toBeNull();
    expect(g.nextAt).toBeNull();
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

describe("calendar day counting", () => {
  it("measures whole days between keys", () => {
    expect(daysBetweenKeys(todayKey(), todayKey())).toBe(0);
    expect(daysBetweenKeys(todayKey(), shiftKey(todayKey(), 3))).toBe(3);
    expect(daysBetweenKeys(todayKey(), shiftKey(todayKey(), -2))).toBe(-2);
  });

  // Anchored to explicit clock times so the result can't depend on when the
  // suite happens to run.
  const at = (dayOffset: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };
  const plant = (lastWatered: number): RealPlant => ({
    id: "x", name: "F", type: "", scheduleDays: 3, created: 0, lastWatered
  });

  it("counts to the due date, not in elapsed hours", () => {
    // Watered late yesterday -> due 2 calendar days out, though ~2.04*24h remain.
    expect(daysUntilNextWater(plant(at(-1, 23)))).toBe(2);
  });

  it("gives the same answer whatever time of day it was watered", () => {
    for (const hour of [1, 9, 14, 23]) {
      expect(daysUntilNextWater(plant(at(0, hour)))).toBe(3);
    }
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

describe("offline amount estimator", () => {
  it("scales capacity by fill level, rounded to 10 mL", () => {
    expect(estimateMl(570, 65)).toBe(370); // pint, two-thirds
    expect(estimateMl(250, 100)).toBe(250); // full glass
    expect(estimateMl(330, 50)).toBe(170); // half a can
    expect(estimateMl(1000, 0)).toBe(0);
  });

  it("never exceeds the per-log ceiling", () => {
    expect(estimateMl(4000, 100)).toBe(1500);
  });

  it("describes fill levels in words", () => {
    expect(fillLabel(100)).toBe("Full");
    expect(fillLabel(50)).toBe("Half");
    expect(fillLabel(0)).toBe("Empty");
  });

  it("keeps every preset within loggable range at full", () => {
    for (const c of CONTAINERS) {
      const ml = estimateMl(c.ml, 100);
      expect(ml).toBeGreaterThanOrEqual(10);
      expect(ml).toBeLessThanOrEqual(1500);
    }
  });
});
