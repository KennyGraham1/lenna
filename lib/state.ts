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

// ---------- Types ----------
export type Checkin = {
  id: string;
  ts: number;
  ml: number;
  coins: number;
  photo: string | null;
};

export type OwnedPlant = { ts: number; x?: number; y?: number };

export type RealPlant = {
  id: string;
  name: string;
  type: string;
  scheduleDays: number;
  lastWatered: number | null;
  created: number;
  lastPhoto?: { ts: number; dataUrl: string };
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
  lastGoalDate: string | null; // YYYY-MM-DD of last day daily goal was hit
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
    return {
      ...base,
      ...parsed,
      reminders: { ...base.reminders, ...(parsed.reminders || {}) }
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded — keep the in-memory state usable */
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

export function coinsFor(ml: number) {
  return Math.round((ml / 100) * COINS_PER_100ML);
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- Streak logic ----------
/** Streak resets if a full day was missed (lastGoalDate older than yesterday). */
export function refreshStreak(state: AppState): AppState {
  if (!state.lastGoalDate) {
    return state.streak === 0 ? state : { ...state, streak: 0 };
  }
  const last = state.lastGoalDate;
  if (last !== todayKey() && last !== yesterdayKey()) {
    return state.streak === 0 ? state : { ...state, streak: 0 };
  }
  return state;
}

// ---------- Logging water ----------
function recentMlInWindow(state: AppState, ms: number) {
  const cutoff = Date.now() - ms;
  return state.checkins.filter((c) => c.ts >= cutoff).reduce((sum, c) => sum + c.ml, 0);
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
    };

export function logWater(
  state: AppState,
  rawMl: number,
  photoDataUrl?: string | null
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

  const day = todayKey();
  const dayTotal = state.history[day] || 0;
  if (dayTotal + ml > DAILY_MAX_ML) {
    return {
      ok: false,
      level: "warn",
      msg: `Daily safe limit is ${DAILY_MAX_ML} mL. You've already logged ${dayTotal} mL today.`
    };
  }

  const recent = recentMlInWindow(state, QUICK_WINDOW_MS);
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
    ts: Date.now(),
    ml,
    coins: earned,
    photo: photoDataUrl || null
  };

  let next: AppState = {
    ...state,
    history: { ...state.history, [day]: dayTotal + ml },
    totalMlLogged: state.totalMlLogged + ml,
    coins: state.coins + earned,
    totalCoinsEarned: state.totalCoinsEarned + earned,
    checkins: [checkin, ...state.checkins].slice(0, 50)
  };

  // Goal / streak bookkeeping
  let goalHit = false;
  if (dayTotal < state.goalMl && next.history[day] >= state.goalMl && state.lastGoalDate !== day) {
    // If yesterday was the last goal day, continue streak. Otherwise restart at 1.
    const streak = state.lastGoalDate === yesterdayKey() ? state.streak + 1 : 1;
    next = {
      ...next,
      streak,
      lastGoalDate: day,
      longestStreak: Math.max(state.longestStreak, streak)
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
    streak: next.streak
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
  photoDataUrl?: string | null
): WaterResult {
  const existing = state.realPlants.find((rp) => rp.id === id);
  if (!existing) return null;

  const today = todayKey();
  let bonus = 0;
  const updated: RealPlant = { ...existing, lastWatered: Date.now() };

  if (photoDataUrl) {
    updated.lastPhoto = { ts: Date.now(), dataUrl: photoDataUrl };
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
      : photoDataUrl
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
