"use client";

import Link from "next/link";
import { STREAK_MILESTONES } from "@/lib/plants";
import { daysUntilNextWater, fmtTime, todayMl } from "@/lib/state";
import { useGarden } from "@/components/GardenProvider";

// Ring circumference ≈ 2 * π * 86 ≈ 540
const RING_DASH = 540;

function realPlantSummary(count: number, due: number) {
  if (!count) {
    return "Add the plants you care for in real life and we'll remind you when to water them.";
  }
  const plural = count === 1 ? "" : "s";
  const tail = due > 0 ? ` — ${due} need${due === 1 ? "s" : ""} watering today 💧` : " — all happy 🌿";
  return `${count} real plant${plural} tracked${tail}`;
}

export default function HomePage() {
  const { state, setReminders, fireReminder } = useGarden();

  const ml = todayMl(state);
  const pct = Math.min(1, ml / state.goalMl);
  const due = state.realPlants.filter((p) => daysUntilNextWater(p) <= 0).length;

  return (
    <section className="screen screen-home active" data-screen="home">
      <div className="hero-card">
        <div className="hero-top">
          <h1>Hello, gardener! 🌼</h1>
          <p className="hero-sub">Sip by sip, grow your garden.</p>
        </div>

        <div className="water-ring">
          <svg viewBox="0 0 200 200" className="ring-svg" aria-hidden="true">
            <circle cx="100" cy="100" r="86" className="ring-bg" />
            <circle
              cx="100"
              cy="100"
              r="86"
              className="ring-fg"
              id="ring-progress"
              style={{ strokeDasharray: RING_DASH, strokeDashoffset: RING_DASH * (1 - pct) }}
            />
          </svg>
          <div className="ring-center">
            <div className="ring-amount">
              {ml.toLocaleString()}
              <small>mL</small>
            </div>
            <div className="ring-goal">of {state.goalMl.toLocaleString()} mL</div>
          </div>
        </div>

        <Link href="/log" className="btn btn-primary btn-big">
          💧 Log water
        </Link>
      </div>

      <div className="card card-row">
        <div className="stat-block">
          <div className="stat-label">Today</div>
          <div className="stat-value">{ml.toLocaleString()} mL</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Streak</div>
          <div className="stat-value">{state.streak} 🔥</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Coins</div>
          <div className="stat-value">{state.coins.toLocaleString()} 🪙</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>💌 Reminders</h2>
          <button
            className={`btn btn-ghost btn-small ${state.reminders.enabled ? "btn-primary" : ""}`}
            onClick={() => setReminders({ enabled: !state.reminders.enabled })}
          >
            {state.reminders.enabled ? "On ✓" : "Off"}
          </button>
        </div>
        <p className="muted">
          Friendly nudges every {state.reminders.intervalMin} min while the app is open.
        </p>
        <div className="row">
          <label>
            Every{" "}
            <select
              value={String(state.reminders.intervalMin)}
              onChange={(e) => setReminders({ intervalMin: Number(e.target.value) })}
            >
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">2 hr</option>
            </select>
          </label>
          <button className="btn btn-ghost btn-small" onClick={fireReminder}>
            Try a nudge
          </button>
        </div>
        <div className="muted small">
          {state.reminders.lastNudge ? `Last nudge: ${fmtTime(state.reminders.lastNudge)}` : ""}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>🪴 My real plants</h2>
          <Link href="/plants" className="btn btn-ghost btn-small">
            Open
          </Link>
        </div>
        <p className="muted">{realPlantSummary(state.realPlants.length, due)}</p>
      </div>

      <div className="card milestones-card">
        <div className="card-head">
          <h2>🏅 Streak milestones</h2>
        </div>
        <div className="milestones">
          {STREAK_MILESTONES.map((n) => (
            <div key={n} className={`milestone ${state.longestStreak >= n ? "reached" : ""}`}>
              <div className="m-num">{n}</div>
              <div>day{n === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
