"use client";

import { useRef, type RefObject } from "react";
import type { CatalogPlant } from "@/lib/plants";
import { hashStr } from "@/lib/state";
import { useGarden } from "./GardenProvider";
import { useToast } from "./ToastProvider";

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startLeftPct: number;
  startTopPct: number;
  gridWidth: number;
  gridHeight: number;
  moved: boolean;
};

export function GardenPlant({
  plantId,
  plant,
  x,
  y,
  index,
  gridRef
}: {
  plantId: string;
  plant: CatalogPlant;
  x: number;
  y: number;
  index: number;
  gridRef: RefObject<HTMLDivElement | null>;
}) {
  const { movePlant } = useGarden();
  const toast = useToast();
  const elRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<DragState | null>(null);

  const sizeClass =
    plant.setId >= 7 ? "g-xl" : plant.setId >= 5 ? "g-lg" : plant.setId >= 3 ? "g-md" : "g-sm";

  const seed = hashStr(plant.id);
  const swayDur = 3 + (seed % 25) / 10;
  const swayDelay = -((seed % 40) / 10);
  const swayDir = seed % 2 === 0 ? "normal" : "reverse";
  const growDelay = Math.min(index * 60, 1500);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = elRef.current;
    const grid = gridRef.current;
    if (!e.isPrimary || !el || !grid) return;
    el.setPointerCapture(e.pointerId);
    const rect = grid.getBoundingClientRect();
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeftPct: parseFloat(el.style.left) || 50,
      startTopPct: parseFloat(el.style.top) || 60,
      gridWidth: rect.width,
      gridHeight: rect.height,
      moved: false
    };
    el.classList.add("dragging");
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = elRef.current;
    if (!d || !el || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
    if (!d.moved) return;
    // Keep plants on the soil, with a small inset
    const leftPct = Math.max(5, Math.min(95, d.startLeftPct + (dx / d.gridWidth) * 100));
    const topPct = Math.max(15, Math.min(100, d.startTopPct + (dy / d.gridHeight) * 100));
    el.style.left = `${leftPct}%`;
    el.style.top = `${topPct}%`;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = elRef.current;
    if (!d || !el || e.pointerId !== d.pointerId) return;
    el.classList.remove("dragging");
    if (d.moved) {
      movePlant(
        plantId,
        (parseFloat(el.style.left) || 50) / 100,
        (parseFloat(el.style.top) || 60) / 100
      );
    } else {
      // Treat as a tap — show plant info
      toast(`${plant.icon} ${plant.name} — Set ${plant.setId}: ${plant.setName}`);
    }
    drag.current = null;
  };

  return (
    <div
      ref={elRef}
      className={`g-plant ${sizeClass}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      title={`${plant.name} — Set ${plant.setId}: ${plant.setName}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="g-plant-inner"
        style={{
          animationDuration: `${swayDur}s`,
          animationDelay: `${swayDelay}s`,
          animationDirection: swayDir
        }}
      >
        <span className="emoji" style={{ animationDelay: `${growDelay}ms` }}>
          {plant.icon}
        </span>
      </div>
      <span className="mound" />
    </div>
  );
}
