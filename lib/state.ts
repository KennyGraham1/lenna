/* =====================================================
   Hydration Garden — state shape, persistence and pure game logic.
   Everything here is framework-free: React components in components/
   call these helpers and commit the returned state.
   ===================================================== */

import { PLANT_BY_ID, PLANT_SETS, type PlantSet } from "./plants";

export const STORAGE_KEY = "hydration-garden-v1";

export const DAILY_MAX_ML = 4000; // hard daily cap
export const QUICK_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const QUICK_WINDOW_MAX_ML = 800; // max mL in any 10-minute window
export const COINS_PER_100ML = 500;
export const DEFAULT_GOAL = 2000;
export const REAL_PLANT_PHOTO_BONUS = 1000;
export const DAILY_LOGIN_BONUS = 350;
export const MAX_STORED_PHOTOS = 8;

// ---------- Types ----------
export type Checkin = {
  id: string;
  ts: number;
  ml: number;
  coins: number;
  photo: string | null;          // legacy inline base64
  media?: MediaRef | null;       // reference into the media store
};

export type MediaRef = { id: string; type: string; name: string; size: number };

export type OwnedPlant = { ts: number; x?: number; y?: number };

export type RealPlant = {
  id: string;
  name: string;
  type: string;
  scheduleDays: number;
  lastWatered: number | null;
  created: number;
  lastPhoto?: { ts: number; dataUrl?: string; media?: MediaRef | null };
  lastBonusDate?: string;
};

export type Reminders = {
  enabled: boolean;
  intervalMin: number;
  lastNudge: number | null;
};

export type AppState = {
  coins: number;
  totalCoinsEarned: number;
  totalMlLogged: number;
  goalMl: number;
  streak: number;
  longestStreak: number;
  lastGoalDate: string | null; // YYYY-MM-DD of most recent day the goal was hit
  goalDays: Record<string, true>; // every YYYY-MM-DD whose goal was met
  history: Record<string, number>; // { "YYYY-MM-DD": totalMl }
  checkins: Checkin[];
  owned: Record<string, OwnedPlant>;
  realPlants: RealPlant[];
  reminders: Reminders;
  lastLoginRewardDate: string | null; // YYYY-MM-DD — daily +350 coin bonus
};

export const defaultState = (): AppState => ({
  coins: 0,
  totalCoinsEarned: 0,
  totalMlLogged: 0,
  goalMl: DEFAULT_GOAL,
  streak: 0,
  longestStreak: 0,
  lastGoalDate: null,
  goalDays: {},
  history: {},
  checkins: [],
  owned: {},
  realPlants: [],
  reminders: { enabled: false, intervalMin: 60, lastNudge: null },
  lastLoginRewardDate: null
});

// ---------- Persistence ----------
export function loadState(): AppState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = defaultState();
    const merged: AppState = {
      ...base,
      ...parsed,
      reminders: { ...base.reminders, ...(parsed.reminders || {}) }
    };

    // Older saves have no goalDays — rebuild from history.
    if (!parsed.goalDays) {
      const goalDays: Record<string, true> = {};
      for (const [day, ml] of Object.entries(merged.history)) {
        if (ml >= merged.goalMl) goalDays[day] = true;
      }
      if (merged.lastGoalDate) goalDays[merged.lastGoalDate] = true;
      merged.goalDays = goalDays;
    }
    return merged;
  } catch {
    return defaultState();
  }
}

// Only legacy inline base64 is big enough to blow the quota.
export function limitPhotos(checkins: Checkin[], keep = MAX_STORED_PHOTOS): Checkin[] {
  let seen = 0;
  return checkins.map((c) => {
    if (!c.photo) return c;
    seen += 1;
    return seen <= keep ? c : { ...c, photo: null };
  });
}

export type SaveOutcome = {
  ok: boolean;         // false = nothing was persisted
  state: AppState;     // what actually reached storage
  trimmed: boolean;
};

export function saveState(state: AppState): SaveOutcome {
  if (typeof window === "undefined") return { ok: true, state, trimmed: false };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true, state, trimmed: false };
  } catch {
    // Shed photos oldest-first rather than losing the write.
    for (const keep of [4, 2, 1, 0]) {
      const trimmedState = { ...state, checkins: limitPhotos(state.checkins, keep) };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedState));
        return { ok: true, state: trimmedState, trimmed: true };
      } catch {
        /* still too big */
      }
    }
    return { ok: false, state, trimmed: false };
  }
}

// ---------- Helpers ----------
export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

function keyToDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Shift a YYYY-MM-DD key by whole days.
export function shiftKey(key: string, days: number) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

export function todayMl(state: AppState) {
  return state.history[todayKey()] || 0;
}

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

// "Aug 22"
export function fmtDay(key: string) {
  return keyToDate(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function coinsFor(ml: number) {
  return Math.round((ml / 100) * COINS_PER_100ML);
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- Streak logic ----------
// Derived from goalDays, so a backdated drink can repair an earlier gap.
export function computeStreak(goalDays: Record<string, true>, today = todayKey()): number {
  const yesterday = shiftKey(today, -1);
  // Until today is met the run is carried by yesterday.
  let cursor = goalDays[today] ? today : goalDays[yesterday] ? yesterday : null;
  if (!cursor) return 0;
  let n = 0;
  while (goalDays[cursor]) {
    n++;
    cursor = shiftKey(cursor, -1);
  }
  return n;
}

export function computeLongestStreak(goalDays: Record<string, true>): number {
  const keys = Object.keys(goalDays).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    run = prev && shiftKey(prev, 1) === k ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  return best;
}

export function refreshStreak(state: AppState): AppState {
  const streak = computeStreak(state.goalDays);
  // Stored best is a floor — old history can't be rebuilt.
  const longestStreak = Math.max(
    state.longestStreak,
    computeLongestStreak(state.goalDays),
    streak
  );
  if (streak === state.streak && longestStreak === state.longestStreak) return state;
  return { ...state, streak, longestStreak };
}

// ---------- Logging water ----------
// mL logged either side of `at`. Measured around the drink's own time so
// backdating can't slip past the cap.
function mlNearTime(state: AppState, at: number, ms: number) {
  return state.checkins
    .filter((c) => Math.abs(c.ts - at) < ms)
    .reduce((sum, c) => sum + c.ml, 0);
}

export type LogResult =
  | { ok: false; level: "error" | "warn"; msg: string }
  | {
      ok: true;
      level: "ok";
      msg: string;
      earned: number;
      checkin: Checkin;
      state: AppState;
      goalHit: boolean;
      streak: number;
      day: string;   // YYYY-MM-DD the drink counted toward
    };

export function logWater(
  state: AppState,
  rawMl: number,
  at: number,
  media?: MediaRef | null
): LogResult {
  const ml = Math.round(Number(rawMl));
  if (!Number.isFinite(ml) || ml < 10) {
    return { ok: false, level: "error", msg: "Please enter at least 10 mL." };
  }
  if (ml > 1500) {
    return {
      ok: false,
      level: "error",
      msg: "That's a lot in one go — try 1500 mL or less per log."
    };
  }

  const ts = Math.round(Number(at));
  if (!Number.isFinite(ts)) {
    return { ok: false, level: "error", msg: "Pick the time you drank it ⏰" };
  }
  // A minute of slack for clock skew.
  if (ts > Date.now() + 60_000) {
    return { ok: false, level: "error", msg: "That time hasn't happened yet ⏰" };
  }

  const day = todayKey(new Date(ts));
  const dayTotal = state.history[day] || 0;
  if (dayTotal + ml > DAILY_MAX_ML) {
    return {
      ok: false,
      level: "warn",
      msg: `Daily safe limit is ${DAILY_MAX_ML} mL. You've already logged ${dayTotal} mL today.`
    };
  }

  const recent = mlNearTime(state, ts, QUICK_WINDOW_MS);
  if (recent + ml > QUICK_WINDOW_MAX_ML) {
    return {
      ok: false,
      level: "warn",
      msg: `Slow down 🐢 max ${QUICK_WINDOW_MAX_ML} mL within 10 minutes — drinking too fast isn't safe.`
    };
  }

  const earned = coinsFor(ml);
  const checkin: Checkin = {
    id: makeId("c"),
    ts,
    ml,
    coins: earned,
    photo: null,
    media: media || null
  };

  let next: AppState = {
    ...state,
    history: { ...state.history, [day]: dayTotal + ml },
    totalMlLogged: state.totalMlLogged + ml,
    coins: state.coins + earned,
    totalCoinsEarned: state.totalCoinsEarned + earned,
    checkins: [checkin, ...state.checkins].sort((a, b) => b.ts - a.ts).slice(0, 50)
  };

  // Goal / streak bookkeeping, recorded per-day.
  let goalHit = false;
  if (dayTotal < state.goalMl && next.history[day] >= state.goalMl && !state.goalDays[day]) {
    const goalDays: Record<string, true> = { ...state.goalDays, [day]: true };
    const streak = computeStreak(goalDays);
    next = {
      ...next,
      goalDays,
      streak,
      lastGoalDate: Object.keys(goalDays).sort().pop() ?? day,
      longestStreak: Math.max(state.longestStreak, computeLongestStreak(goalDays), streak)
    };
    goalHit = true;
  }

  return {
    ok: true,
    level: "ok",
    msg: `+${earned.toLocaleString()} 🪙 for ${ml} mL!`,
    earned,
    checkin,
    state: next,
    goalHit,
    streak: next.streak,
    day
  };
}

// ---------- Growth ----------
// Plants advance a stage for each day you hit your water goal after planting,
// so the garden is a record of the habit rather than of elapsed time.
export const GROWTH_STAGES = [
  { at: 0, name: "Seedling", scale: 0.55 },
  { at: 1, name: "Sprout", scale: 0.72 },
  { at: 3, name: "Growing", scale: 0.86 },
  { at: 7, name: "Mature", scale: 1 },
  { at: 14, name: "Blooming", scale: 1.12 }
] as const;

export type Growth = {
  index: number;
  name: string;
  scale: number;
  days: number;          // goal-days since planting
  nextAt: number | null; // goal-days the next stage needs
  toNext: number | null;
};

// Day keys sort lexically, so a string compare is a date compare.
export function growthDays(state: AppState, plantedTs: number) {
  const planted = todayKey(new Date(plantedTs));
  return Object.keys(state.goalDays).filter((d) => d >= planted).length;
}

export function growthFor(state: AppState, plantedTs: number): Growth {
  const days = growthDays(state, plantedTs);
  let index = 0;
  GROWTH_STAGES.forEach((stage, i) => {
    if (days >= stage.at) index = i;
  });
  const stage = GROWTH_STAGES[index];
  const next = GROWTH_STAGES[index + 1] ?? null;
  return {
    index,
    name: stage.name,
    scale: stage.scale,
    days,
    nextAt: next ? next.at : null,
    toNext: next ? Math.max(0, next.at - days) : null
  };
}

// ---------- Shop ----------
export function isSetUnlocked(state: AppState, setIndex: number) {
  if (setIndex === 0) return true;
  const prev = PLANT_SETS[setIndex - 1];
  return prev.plants.every((p) => state.owned[p.id]);
}

export function ownedCountInSet(state: AppState, set: PlantSet) {
  return set.plants.filter((p) => state.owned[p.id]).length;
}

export type BuyResult =
  | { ok: false; msg: string; level: "" | "warn" }
  | { ok: true; state: AppState; msg: string; setCompleted: PlantSet | null };

export function buyPlant(state: AppState, plantId: string): BuyResult {
  const plant = PLANT_BY_ID[plantId];
  if (!plant) return { ok: false, msg: "Unknown plant.", level: "warn" };
  if (state.owned[plantId]) return { ok: false, msg: "You already own this one 🌿", level: "" };

  const setIndex = plant.setId - 1;
  if (!isSetUnlocked(state, setIndex)) {
    return { ok: false, msg: "Complete the previous set first 🔒", level: "warn" };
  }
  if (state.coins < plant.price) {
    return {
      ok: false,
      msg: `Need ${(plant.price - state.coins).toLocaleString()} more coins 🪙`,
      level: "warn"
    };
  }

  const next: AppState = {
    ...state,
    coins: state.coins - plant.price,
    owned: { ...state.owned, [plantId]: { ts: Date.now() } }
  };

  const set = PLANT_SETS[setIndex];
  const setCompleted = ownedCountInSet(next, set) === set.plants.length ? set : null;

  return {
    ok: true,
    state: next,
    msg: `${plant.icon} ${plant.name} added to your garden!`,
    setCompleted
  };
}

// ---------- Real plants ----------
export function daysUntilNextWater(p: RealPlant) {
  if (!p.lastWatered) return -1; // never watered = due now
  const due = p.lastWatered + p.scheduleDays * 24 * 60 * 60 * 1000;
  return Math.ceil((due - Date.now()) / (24 * 60 * 60 * 1000));
}

export function addRealPlant(
  state: AppState,
  name: string,
  type: string,
  days: number | string
): AppState | null {
  if (!name.trim()) return null;
  const plant: RealPlant = {
    id: makeId("rp"),
    name: name.trim(),
    type: type.trim(),
    scheduleDays: Math.max(1, Number(days) || 7),
    lastWatered: null,
    created: Date.now()
  };
  return { ...state, realPlants: [...state.realPlants, plant] };
}

export type WaterResult = { state: AppState; msg: string } | null;

export function waterRealPlant(
  state: AppState,
  id: string,
  media?: MediaRef | null
): WaterResult {
  const existing = state.realPlants.find((rp) => rp.id === id);
  if (!existing) return null;

  const today = todayKey();
  let bonus = 0;
  const updated: RealPlant = { ...existing, lastWatered: Date.now() };

  if (media) {
    updated.lastPhoto = { ts: Date.now(), media };
    if (existing.lastBonusDate !== today) {
      bonus = REAL_PLANT_PHOTO_BONUS;
      updated.lastBonusDate = today;
    }
  }

  const next: AppState = {
    ...state,
    coins: state.coins + bonus,
    totalCoinsEarned: state.totalCoinsEarned + bonus,
    realPlants: state.realPlants.map((rp) => (rp.id === id ? updated : rp))
  };

  const msg =
    bonus > 0
      ? `💧 ${updated.name} watered! +${bonus.toLocaleString()} 🪙 photo bonus 🎉`
      : media
        ? `💧 ${updated.name} watered! (photo bonus already claimed today)`
        : `💧 Watered ${updated.name}!`;

  return { state: next, msg };
}

export function removeRealPlant(state: AppState, id: string): AppState {
  return { ...state, realPlants: state.realPlants.filter((rp) => rp.id !== id) };
}

// ---------- Daily login bonus ----------
export function claimDailyLogin(state: AppState): AppState | null {
  const today = todayKey();
  if (state.lastLoginRewardDate === today) return null;
  return {
    ...state,
    coins: state.coins + DAILY_LOGIN_BONUS,
    totalCoinsEarned: state.totalCoinsEarned + DAILY_LOGIN_BONUS,
    lastLoginRewardDate: today
  };
}

// ---------- Misc ----------
export function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function clampGoal(raw: number) {
  const g = Number.isFinite(raw) ? raw : DEFAULT_GOAL;
  return Math.max(500, Math.min(3500, Math.round(g / 100) * 100));
}
