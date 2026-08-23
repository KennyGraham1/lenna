"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";

type Props = {
  value: Date;
  onChange: (next: Date) => void;
  /** Latest selectable moment — future drinks make no sense. */
  max?: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function describe(d: Date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay(d, now)) return { day: "Today", time };
  if (sameDay(d, yesterday)) return { day: "Yesterday", time };
  return {
    day: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    time
  };
}

/** Relative shortcuts — the common case is "a little while ago". */
const QUICK = [
  { label: "Now", minutes: 0 },
  { label: "15 min ago", minutes: 15 },
  { label: "1 hour ago", minutes: 60 },
  { label: "3 hours ago", minutes: 180 }
];

export function DateTimePicker({ value, onChange, max }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const label = useMemo(() => describe(value), [value]);
  const ceiling = max ?? new Date();

  // Dismiss on outside click or Escape, and hand focus back to the trigger.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  /** Never let a selection land in the future (e.g. picking today at 11pm). */
  const commit = (next: Date) => onChange(next > ceiling ? ceiling : next);

  const pickDay = (day: Date | undefined) => {
    if (!day) return;
    const next = new Date(day);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    commit(next);
  };

  const pickTime = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    const next = new Date(value);
    next.setHours(h, m, 0, 0);
    commit(next);
  };

  return (
    <div className="dtp" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`dtp-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="dtp-trigger-icon" aria-hidden="true">
          🕒
        </span>
        <span className="dtp-trigger-text">
          <strong>{label.day}</strong>
          <small>{label.time}</small>
        </span>
        <span className="dtp-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div
          className="dtp-panel"
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-label="Choose when you drank it"
        >
          <div className="dtp-quick">
            {QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                className="dtp-chip"
                onClick={() => {
                  commit(new Date(Date.now() - q.minutes * 60_000));
                  setOpen(false);
                }}
              >
                {q.label}
              </button>
            ))}
          </div>

          <DayPicker
            mode="single"
            selected={value}
            onSelect={pickDay}
            disabled={{ after: ceiling }}
            defaultMonth={value}
            showOutsideDays
            weekStartsOn={1}
          />

          <div className="dtp-time">
            <label>
              <span>Time</span>
              <input
                type="time"
                value={`${pad(value.getHours())}:${pad(value.getMinutes())}`}
                onChange={(e) => pickTime(e.target.value)}
              />
            </label>
            <button type="button" className="dtp-done" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
