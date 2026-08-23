"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { clearAttachments } from "@/lib/mediaStore";
import { REMINDER_MESSAGES } from "@/lib/plants";
import * as game from "@/lib/state";
import type { AppState, LogResult, MediaRef } from "@/lib/state";
import { useToast } from "./ToastProvider";

type GardenContextValue = {
  state: AppState;
  logWater: (ml: number, at: number, media?: MediaRef | null) => LogResult;
  buy: (plantId: string) => void;
  addPlant: (name: string, type: string, days: number | string) => boolean;
  water: (id: string, media?: MediaRef | null) => void;
  removePlant: (id: string) => void;
  movePlant: (id: string, x: number, y: number) => void;
  setGoal: (goal: number) => void;
  setReminders: (patch: Partial<AppState["reminders"]>) => void;
  fireReminder: () => void;
  clearCheckins: () => void;
  reset: () => void;
};

const GardenContext = createContext<GardenContextValue | null>(null);

export function useGarden() {
  const ctx = useContext(GardenContext);
  if (!ctx) throw new Error("useGarden must be used inside <GardenProvider>");
  return ctx;
}

async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export function GardenProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [state, setState] = useState<AppState>(game.defaultState);
  const [hydrated, setHydrated] = useState(false);

  // Mirrors `state` so action handlers always read the freshest value
  // without going stale inside callbacks or timers.
  const ref = useRef<AppState>(state);

  // Warn at most once per session; a full disk shouldn't nag on every sip.
  const warnedRef = useRef(false);

  const commit = useCallback(
    (next: AppState) => {
      const outcome = game.saveState(next);
      // Commit what was actually persisted, so memory can't drift from disk.
      ref.current = outcome.state;
      setState(outcome.state);
      if (!warnedRef.current && (outcome.trimmed || !outcome.ok)) {
        warnedRef.current = true;
        toast(
          outcome.ok
            ? "📸 Storage is full — older check-in photos were removed."
            : "⚠️ Couldn't save progress — device storage is full.",
          "warn"
        );
      }
    },
    [toast]
  );

  // ---------- Hydrate from localStorage ----------
  useEffect(() => {
    let next = game.refreshStreak(game.loadState());
    const withBonus = game.claimDailyLogin(next);
    if (withBonus) {
      next = withBonus;
      // Show after the first paint so the coin bump is noticed.
      setTimeout(
        () => toast(`🌅 Daily login bonus: +${game.DAILY_LOGIN_BONUS} 🪙`, "ok"),
        900
      );
    }
    commit(next);
    setHydrated(true);
  }, [commit, toast]);

  // Catch a day rollover while the tab sat in the background.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const next = game.refreshStreak(ref.current);
      if (next !== ref.current) commit(next);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [commit]);

  // ---------- Actions ----------
  const logWater = useCallback<GardenContextValue["logWater"]>(
    (ml, at, media) => {
      const result = game.logWater(ref.current, ml, at, media);
      if (result.ok) {
        commit(result.state);
        if (result.goalHit) {
          const forToday = result.day === game.todayKey();
          toast(
            forToday
              ? `🎉 Daily goal hit! Streak ${result.streak} 🔥`
              : `🎉 Goal completed for ${game.fmtDay(result.day)}! Streak ${result.streak} 🔥`,
            "ok"
          );
        }
      }
      return result;
    },
    [commit, toast]
  );

  const buy = useCallback<GardenContextValue["buy"]>(
    (plantId) => {
      const result = game.buyPlant(ref.current, plantId);
      if (!result.ok) {
        toast(result.msg, result.level);
        return;
      }
      commit(result.state);
      toast(result.msg, "ok");
      if (result.setCompleted) {
        const set = result.setCompleted;
        setTimeout(() => toast(`🏆 Set complete: ${set.name}! Next set unlocked.`, "ok"), 600);
      }
    },
    [commit, toast]
  );

  const addPlant = useCallback<GardenContextValue["addPlant"]>(
    (name, type, days) => {
      const next = game.addRealPlant(ref.current, name, type, days);
      if (!next) return false;
      commit(next);
      return true;
    },
    [commit]
  );

  const water = useCallback<GardenContextValue["water"]>(
    (id, media) => {
      const result = game.waterRealPlant(ref.current, id, media);
      if (!result) return;
      commit(result.state);
      toast(result.msg, "ok");
    },
    [commit, toast]
  );

  const removePlant = useCallback<GardenContextValue["removePlant"]>(
    (id) => commit(game.removeRealPlant(ref.current, id)),
    [commit]
  );

  const movePlant = useCallback<GardenContextValue["movePlant"]>(
    (id, x, y) => {
      const owned = ref.current.owned[id];
      if (!owned) return;
      commit({
        ...ref.current,
        owned: { ...ref.current.owned, [id]: { ...owned, x, y } }
      });
    },
    [commit]
  );

  const setGoal = useCallback<GardenContextValue["setGoal"]>(
    (goal) => {
      const goalMl = game.clampGoal(goal);
      commit({ ...ref.current, goalMl });
      toast(`Daily goal set to ${goalMl} mL 💧`, "ok");
    },
    [commit, toast]
  );

  const fireReminder = useCallback(() => {
    const msg = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
    commit({
      ...ref.current,
      reminders: { ...ref.current.reminders, lastNudge: Date.now() }
    });
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Hydration Garden", { body: msg });
      } catch {
        /* fall through to the toast */
      }
    }
    toast(msg);
  }, [commit, toast]);

  const setReminders = useCallback<GardenContextValue["setReminders"]>(
    (patch) => {
      if (patch.enabled) void ensureNotificationPermission();
      commit({
        ...ref.current,
        reminders: { ...ref.current.reminders, ...patch }
      });
    },
    [commit]
  );

  const clearCheckins = useCallback(
    () => commit({ ...ref.current, checkins: [] }),
    [commit]
  );

  const reset = useCallback(() => {
    // Attachments live outside app state, so clear the media store too.
    void clearAttachments();
    commit(game.defaultState());
    toast("Fresh start 🌱", "ok");
  }, [commit, toast]);

  // ---------- Reminder timer ----------
  const { enabled, intervalMin } = state.reminders;
  useEffect(() => {
    if (!hydrated || !enabled) return;
    const id = setInterval(fireReminder, intervalMin * 60 * 1000);
    return () => clearInterval(id);
  }, [hydrated, enabled, intervalMin, fireReminder]);

  // Render nothing app-shaped until localStorage is read, so the server HTML
  // and the first client render agree (no hydration mismatch, no flash of 0s).
  if (!hydrated) {
    return (
      <div className="boot-splash" role="status" aria-label="Loading">
        <span>🌱</span>
      </div>
    );
  }

  return (
    <GardenContext.Provider
      value={{
        state,
        logWater,
        buy,
        addPlant,
        water,
        removePlant,
        movePlant,
        setGoal,
        setReminders,
        fireReminder,
        clearCheckins,
        reset
      }}
    >
      {children}
    </GardenContext.Provider>
  );
}
