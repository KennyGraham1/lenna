"use client";

import { useState } from "react";
import { daysUntilNextWater, todayKey, type RealPlant } from "@/lib/state";
import { useCamera } from "@/components/CameraProvider";
import { useGarden } from "@/components/GardenProvider";
import { useToast } from "@/components/ToastProvider";

const SCHEDULES = [1, 2, 3, 5, 7, 10, 14];

function nextWatering(p: RealPlant) {
  const days = daysUntilNextWater(p);
  if (days < 0 && !p.lastWatered) return { label: "Needs first watering 💧", cls: "due" };
  if (days <= 0) return { label: "Water today 💧", cls: "due" };
  if (days === 1) return { label: "Water tomorrow", cls: "soon" };
  return { label: `Water in ${days} days`, cls: "ok" };
}

export default function PlantsPage() {
  const { state, addPlant, water, removePlant } = useGarden();
  const openCamera = useCamera();
  const toast = useToast();

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [schedule, setSchedule] = useState("7");

  const today = todayKey();

  const add = () => {
    if (!name.trim()) {
      toast("Give your plant a name 🌱", "warn");
      return;
    }
    addPlant(name, type, schedule);
    setName("");
    setType("");
    toast("Plant added 🪴", "ok");
  };

  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  const waterWithPhoto = async (p: RealPlant) => {
    const dataUrl = await openCamera(`Photo: ${p.name}`);
    if (!dataUrl) return; // user cancelled — don't water
    water(p.id, dataUrl);
  };

  return (
    <section className="screen screen-plants active" data-screen="plants">
      <div className="card">
        <h1>🪴 Real plant reminders</h1>
        <p className="muted">Keep your real-life plants happy too.</p>

        <div className="row">
          <input
            type="text"
            placeholder="Plant name (e.g. Fern by window)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onEnter}
          />
          <input
            type="text"
            placeholder="Type (e.g. Boston Fern)"
            value={type}
            onChange={(e) => setType(e.target.value)}
            onKeyDown={onEnter}
          />
        </div>
        <div className="row">
          <label>
            Water every{" "}
            <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
              {SCHEDULES.map((d) => (
                <option key={d} value={String(d)}>
                  {d} day{d === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={add}>
            Add plant
          </button>
        </div>
      </div>

      <div className="rp-list">
        {state.realPlants.map((p) => {
          const next = nextWatering(p);
          const bonusClaimed = p.lastBonusDate === today;
          return (
            <div key={p.id} className="rp-card">
              <div className="rp-icon">🪴</div>
              <div className="rp-info">
                <div className="name">{p.name}</div>
                <div className="meta">
                  {p.type || "Plant"} · every {p.scheduleDays} day
                  {p.scheduleDays === 1 ? "" : "s"}
                </div>
                <div className={`next ${next.cls}`}>{next.label}</div>
              </div>
              <div className="rp-actions">
                <button className="water" onClick={() => water(p.id)}>
                  💧 Water
                </button>
                <button
                  className={`water-photo ${bonusClaimed ? "claimed" : ""}`}
                  onClick={() => waterWithPhoto(p)}
                >
                  {bonusClaimed ? "📸 Bonus claimed" : "📸 +1000 🪙"}
                </button>
                <button
                  className="remove"
                  onClick={() => {
                    if (window.confirm("Remove this plant?")) removePlant(p.id);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {state.realPlants.length === 0 && (
        <div className="card empty">
          <p>No real plants yet 🌱</p>
        </div>
      )}
    </section>
  );
}
