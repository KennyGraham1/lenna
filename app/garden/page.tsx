"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PLANT_BY_ID } from "@/lib/plants";
import { GROWTH_STAGES, growthFor } from "@/lib/state";
import { GardenPlant } from "@/components/GardenPlant";
import { useGarden } from "@/components/GardenProvider";

const COLS = 6;

function skyPhase(hour: number) {
  if (hour < 5) return "night";
  if (hour < 8) return "dawn";
  if (hour < 17) return "day";
  if (hour < 20) return "dusk";
  return "night";
}

export default function GardenPage() {
  const { state, tidyGarden } = useGarden();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState(() => skyPhase(new Date().getHours()));

  // Roll the sky over as the day passes.
  useEffect(() => {
    const id = setInterval(() => setPhase(skyPhase(new Date().getHours())), 60_000);
    return () => clearInterval(id);
  }, []);

  const owned = useMemo(
    () =>
      Object.entries(state.owned)
        .filter(([id]) => PLANT_BY_ID[id])
        .map(([id, meta]) => ({
          id,
          meta,
          catalog: PLANT_BY_ID[id],
          growth: growthFor(state, meta.ts)
        }))
        .sort((a, b) => a.catalog.setId - b.catalog.setId || a.meta.ts - b.meta.ts),
    [state]
  );

  const rows = Math.max(1, Math.ceil(owned.length / COLS));
  const bedHeight = 220 + Math.max(0, rows - 2) * 70;
  const blooming = owned.filter((o) => o.growth.index >= GROWTH_STAGES.length - 1).length;
  const arranged = Object.values(state.owned).some((m) => typeof m.x === "number");
  const detail = owned.find((o) => o.id === selected) ?? null;

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <h1>🌿 My garden</h1>
          {arranged && (
            <button className="btn btn-ghost btn-small" onClick={tidyGarden}>
              Tidy up
            </button>
          )}
        </div>
        <p className="muted">
          {owned.length} plant{owned.length === 1 ? "" : "s"}
          {blooming > 0 ? ` · ${blooming} blooming ✨` : ""}
        </p>
        <p className="muted small">
          ✋ Drag to rearrange, tap to inspect. Plants grow a stage each day you hit your
          water goal.
        </p>
      </div>

      <div className={`garden-scene sky-${phase}`}>
        <div className="sky-strip">
          {phase === "night" ? (
            <>
              <span className="moon">🌙</span>
              <span className="star star-a">✦</span>
              <span className="star star-b">✧</span>
              <span className="star star-c">✦</span>
            </>
          ) : (
            <span className="sun">{phase === "dusk" ? "🌇" : "☀️"}</span>
          )}
          <span className="cloud cloud-a">☁️</span>
          <span className="cloud cloud-b">☁️</span>
          <span className="cloud cloud-c">☁️</span>
          {phase !== "night" && (
            <>
              <span className="bird bird-a">🦋</span>
              <span className="bird bird-b">🐝</span>
            </>
          )}
        </div>

        <div className="planting-area" ref={gridRef} style={{ height: `${bedHeight}px` }}>
          {owned.map((entry, i) => {
            const hasCoords =
              typeof entry.meta.x === "number" && typeof entry.meta.y === "number";
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const x = hasCoords
              ? (entry.meta.x as number)
              : 0.08 + (col / Math.max(COLS - 1, 1)) * 0.84;
            const y = hasCoords
              ? (entry.meta.y as number)
              : rows === 1
                ? 0.6
                : 0.3 + (row / Math.max(rows - 1, 1)) * 0.65;

            return (
              <GardenPlant
                key={entry.id}
                plantId={entry.id}
                plant={entry.catalog}
                x={x}
                y={y}
                index={i}
                gridRef={gridRef}
                growth={entry.growth}
                selected={entry.id === selected}
                onSelect={setSelected}
              />
            );
          })}
        </div>

        <div className="grass-line" />
      </div>

      {detail && (
        <div className="card plant-detail">
          <button
            className="detail-close"
            aria-label="Close plant details"
            onClick={() => setSelected(null)}
          >
            ✕
          </button>
          <div className="detail-head">
            <span className="detail-icon">{detail.catalog.icon}</span>
            <div>
              <h2>{detail.catalog.name}</h2>
              <p className="muted small">
                Set {detail.catalog.setId}: {detail.catalog.setName}
              </p>
            </div>
          </div>

          <div className="detail-stage">
            <span className="stage-name">{detail.growth.name}</span>
            <span className="muted small">
              {detail.growth.toNext === null
                ? "Fully grown 🎉"
                : `${detail.growth.toNext} more goal day${
                    detail.growth.toNext === 1 ? "" : "s"
                  } to ${GROWTH_STAGES[detail.growth.index + 1].name}`}
            </span>
          </div>

          <div className="stage-track">
            {GROWTH_STAGES.map((stage, i) => (
              <div
                key={stage.name}
                className={`stage-pip ${i <= detail.growth.index ? "on" : ""}`}
                title={stage.name}
              />
            ))}
          </div>

          <p className="muted small">
            Planted {new Date(detail.meta.ts).toLocaleDateString()} ·{" "}
            {detail.growth.days} goal day{detail.growth.days === 1 ? "" : "s"} since
          </p>
        </div>
      )}

      {owned.length === 0 && (
        <div className="card empty">
          <p>Your garden is waiting! 🌱</p>
          <Link href="/shop" className="btn btn-primary">
            Visit the shop
          </Link>
        </div>
      )}
    </section>
  );
}
