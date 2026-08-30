"use client";

import { useState } from "react";
import { coinsFor, fmtTime, DAILY_MAX_ML, DURATIONS, type MediaRef } from "@/lib/state";
import { pickAnyFile } from "@/lib/photo";
import { dataUrlToBlob, saveAttachment } from "@/lib/mediaStore";
import { StoredMedia } from "@/components/StoredMedia";
import { AmountEstimator } from "@/components/AmountEstimator";
import { DateTimePicker } from "@/components/DateTimePicker";
import { useCamera } from "@/components/CameraProvider";
import { useGarden } from "@/components/GardenProvider";
import { useToast } from "@/components/ToastProvider";

const QUICK_AMOUNTS = [100, 200, 250, 330, 500, 750];

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const hours = min / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

export default function LogPage() {
  const { state, logWater, clearCheckins } = useGarden();
  const openCamera = useCamera();
  const toast = useToast();

  const [amount, setAmount] = useState("");
  const [drankAt, setDrankAt] = useState(() => new Date());
  const [durationMin, setDurationMin] = useState(0);
  const [attachment, setAttachment] = useState<MediaRef | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; level: string } | null>(null);

  const submit = () => {
    const result = logWater(Number(amount), drankAt.getTime(), durationMin, attachment);
    setFeedback({ msg: result.msg, level: result.level });
    if (result.ok) {
      setAmount("");
      setAttachment(null);
      setDrankAt(new Date());
      setDurationMin(0);
      toast(result.msg, "ok");
    }
  };

  // Saved on pick, so nothing is lost if the log is abandoned.
  const keep = async (file: Blob | File | null, fallbackName: string) => {
    if (!file) return;
    const saved = await saveAttachment(file, fallbackName);
    if (saved) setAttachment(saved);
    else toast("Couldn't save that file — storage is unavailable.", "warn");
  };

  const capture = async () => {
    const dataUrl = await openCamera("Photo your drink");
    if (dataUrl) await keep(await dataUrlToBlob(dataUrl), "check-in.jpg");
  };

  const upload = async () => {
    await keep(await pickAnyFile(), "attachment");
  };

  const clear = () => {
    if (!state.checkins.length) return;
    if (window.confirm("Clear all photo check-ins? Your water totals stay.")) clearCheckins();
  };

  return (
    <section className="screen">
      <div className="card">
        <h1>💧 Log water</h1>
        <p className="muted">Every 100 mL earns you 500 coins.</p>

        <div className="quick-amounts">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              className={`amount-btn ${amount === String(a) ? "active" : ""}`}
              onClick={() => setAmount(String(a))}
            >
              {a} mL
            </button>
          ))}
        </div>

        <label className="field">
          <span>Amount (mL)</span>
          <input
            type="number"
            min="10"
            max="2000"
            step="10"
            placeholder="e.g. 250"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>

        <div className="field">
          <span>When you drank it</span>
          <DateTimePicker value={drankAt} onChange={setDrankAt} />
        </div>

        <div className="field">
          <span>Over how long?</span>
          <div className="duration-chips">
            {DURATIONS.map((d) => (
              <button
                key={d.min}
                type="button"
                className={`duration-chip ${durationMin === d.min ? "active" : ""}`}
                onClick={() => setDurationMin(d.min)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <AmountEstimator onUse={(ml) => setAmount(String(ml))} />

        <div className="reward-preview">
          <span>You&apos;ll earn</span>
          <strong>{coinsFor(Number(amount) || 0).toLocaleString()} 🪙</strong>
        </div>

        <div className="field">
          <span>📸 Photo check-in (optional)</span>
          <div className="photo-buttons">
            <button className="btn-photo" onClick={capture}>
              📷 Camera
            </button>
            <button className="btn-photo btn-photo-alt" onClick={upload}>
              📁 Attach file
            </button>
          </div>
          {attachment && (
            <button className="btn btn-ghost btn-small" onClick={() => setAttachment(null)}>
              Remove attachment
            </button>
          )}
        </div>
        {attachment && (
          <div className="photo-preview">
            <StoredMedia media={attachment} alt="check-in" />
          </div>
        )}

        <button className="btn btn-primary btn-big" onClick={submit}>
          Log it 🎉
        </button>
        {feedback && <div className={`feedback ${feedback.level}`}>{feedback.msg}</div>}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>📋 Recent check-ins</h2>
          <button className="btn btn-ghost btn-small" title="Clear all check-ins" onClick={clear}>
            Clear
          </button>
        </div>
        <ul className="checkin-list">
          {!state.checkins.length && <li className="muted">No check-ins yet — log your first sip!</li>}
          {state.checkins.slice(0, 10).map((c) => (
            <li key={c.id}>
              <div className="checkin-thumb">
                {c.media || c.photo ? (
                  <StoredMedia media={c.media} legacy={c.photo} alt="" />
                ) : (
                  "💧"
                )}
              </div>
              <div className="checkin-meta">
                <div className="ml">{c.ml} mL</div>
                <div className="time">
                  {fmtTime(c.ts)}
                  {c.durationMin ? ` · over ${formatDuration(c.durationMin)}` : ""}
                </div>
              </div>
              <div className="checkin-reward">+{c.coins.toLocaleString()} 🪙</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card health-note">
        <strong>💚 Drink in a healthy, balanced way.</strong>
        <p className="muted">
          Most adults need around 2 L per day. The app caps logged water at{" "}
          {DAILY_MAX_ML / 1000} L per day and limits very fast logging to keep things safe.
        </p>
      </div>
    </section>
  );
}
