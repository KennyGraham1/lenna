"use client";

import { useEffect, useState } from "react";
import { PLANT_SETS } from "@/lib/plants";
import { clampGoal, ownedCountInSet } from "@/lib/state";
import { useGarden } from "@/components/GardenProvider";

export default function ProfilePage() {
  const { state, setGoal, reset } = useGarden();
  const [goalInput, setGoalInput] = useState(String(state.goalMl));

  // Keep the field in sync when the stored goal changes (clamping, reset).
  useEffect(() => setGoalInput(String(state.goalMl)), [state.goalMl]);

  const completed = PLANT_SETS.filter((s) => ownedCountInSet(state, s) === s.plants.length);

  return (
    <section className="screen screen-profile active" data-screen="profile">
      <div className="card profile-hero">
        <div className="avatar">🌻</div>
        <h1>Your gardener stats</h1>
      </div>

      <div className="card stats-grid">
        <div className="stat-tile">
          <div className="stat-tile-label">Total water</div>
          <div className="stat-tile-value">{state.totalMlLogged.toLocaleString()} mL</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Longest streak</div>
          <div className="stat-tile-value">{state.longestStreak} 🔥</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Current streak</div>
          <div className="stat-tile-value">{state.streak} 🔥</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Coins earned</div>
          <div className="stat-tile-value">{state.totalCoinsEarned.toLocaleString()} 🪙</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Plants owned</div>
          <div className="stat-tile-value">{Object.keys(state.owned).length} 🌿</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Sets completed</div>
          <div className="stat-tile-value">{completed.length} 🏆</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>🎯 Daily goal</h2>
        </div>
        <label className="field">
          <span>Daily water goal (mL)</span>
          <input
            type="number"
            min="500"
            max="3500"
            step="100"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            onBlur={() => {
              // Mirrors the old `change` event: only commit a real edit, so
              // tabbing through the field doesn't fire a "goal set" toast.
              if (clampGoal(Number(goalInput)) === state.goalMl) {
                setGoalInput(String(state.goalMl));
                return;
              }
              setGoal(Number(goalInput));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </label>
        <p className="muted small">Recommended: 1500-2500 mL for most adults. Max 3500 mL.</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>🏆 Completed sets</h2>
        </div>
        <div className="completed-sets">
          {PLANT_SETS.map((s) => {
            const done = ownedCountInSet(state, s) === s.plants.length;
            return (
              <span key={s.id} className={`set-badge ${done ? "" : "muted"}`}>
                {done ? "🏆 " : ""}Set {s.id}
              </span>
            );
          })}
        </div>
      </div>

      <div className="card danger">
        <div className="card-head">
          <h2>⚠️ Reset</h2>
        </div>
        <p className="muted">Erases all progress, coins, plants, and check-ins.</p>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm("Reset all progress? This cannot be undone.")) reset();
          }}
        >
          Reset everything
        </button>
      </div>
    </section>
  );
}
