"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { PLANT_BY_ID } from "@/lib/plants";
import { GardenPlant } from "@/components/GardenPlant";
import { useGarden } from "@/components/GardenProvider";

const COLS = 6;

export default function GardenPage() {
  const { state } = useGarden();
  const gridRef = useRef<HTMLDivElement | null>(null);

  const owned = useMemo(
    () =>
      Object.entries(state.owned)
        .filter(([id]) => PLANT_BY_ID[id])
        .map(([id, meta]) => ({ id, meta, catalog: PLANT_BY_ID[id] }))
        .sort((a, b) => a.catalog.setId - b.catalog.setId || a.meta.ts - b.meta.ts),
    [state.owned]
  );

  // Grow the bed to fit auto-placed plants
  const rows = Math.max(1, Math.ceil(owned.length / COLS));
  const bedHeight = 220 + Math.max(0, rows - 2) * 70;

  return (
    <section className="screen screen-garden active" data-screen="garden">
      <div className="card">
        <h1>🌿 My garden</h1>
        <p className="muted">{owned.length} plants growing happily.</p>
        <p className="muted small">✋ Tip: drag any plant to move it around the soil.</p>
      </div>

      <div className="garden-scene">
        <div className="sky-strip">
          <span className="sun">☀️</span>
          <span className="cloud cloud-a">☁️</span>
          <span className="cloud cloud-b">☁️</span>
          <span className="cloud cloud-c">☁️</span>
          <span className="bird bird-a">🦋</span>
          <span className="bird bird-b">🐝</span>
        </div>

        <div className="planting-area" ref={gridRef} style={{ height: `${bedHeight}px` }}>
          {owned.map((entry, i) => {
            // Saved coords win; otherwise auto-place on a 6-column grid.
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
              />
            );
          })}
        </div>

        <div className="grass-line" />
      </div>

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
