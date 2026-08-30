"use client";

import { useEffect, useState } from "react";
import { CONTAINERS, estimateMl, fillLabel } from "@/lib/containers";

// Offline estimator: pick the container, say how full it was.
const LAST_CONTAINER_KEY = "hydration-garden-last-container";

export function AmountEstimator({ onUse }: { onUse: (ml: number) => void }) {
  const [open, setOpen] = useState(false);
  const [containerId, setContainerId] = useState(CONTAINERS[1].id);
  const [fill, setFill] = useState(100);

  // Most people drink from the same few things — start where they left off.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAST_CONTAINER_KEY);
      if (saved && CONTAINERS.some((c) => c.id === saved)) setContainerId(saved);
    } catch {
      /* storage unavailable — the default is fine */
    }
  }, []);

  const chooseContainer = (id: string) => {
    setContainerId(id);
    try {
      window.localStorage.setItem(LAST_CONTAINER_KEY, id);
    } catch {
      /* not worth surfacing */
    }
  };

  const container = CONTAINERS.find((c) => c.id === containerId) ?? CONTAINERS[1];
  const ml = estimateMl(container.ml, fill);

  return (
    <div className="estimator">
      <button
        type="button"
        className={`btn btn-ghost btn-small estimator-toggle ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        📐 Not sure how much?
      </button>

      {open && (
        <div className="estimator-panel">
          <div className="estimator-chips">
            {CONTAINERS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`estimator-chip ${c.id === containerId ? "active" : ""}`}
                onClick={() => chooseContainer(c.id)}
              >
                <span aria-hidden="true">{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          <p className="muted small estimator-capacity">
            {container.label} · {container.ml} mL when full
          </p>

          <label className="estimator-fill">
            <span>
              How full? <strong>{fillLabel(fill)}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={fill}
              onChange={(e) => setFill(Number(e.target.value))}
              aria-label="How full the container was"
            />
          </label>

          <div className="estimator-result">
            <div className="estimator-ml">
              ≈ <strong>{ml}</strong> mL
            </div>
            <button
              type="button"
              className="btn btn-primary btn-small"
              disabled={ml < 10}
              onClick={() => {
                onUse(ml);
                setOpen(false);
              }}
            >
              Use this
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
