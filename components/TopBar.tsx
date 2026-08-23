"use client";

import { useEffect, useRef, useState } from "react";
import { useGarden } from "./GardenProvider";

export function TopBar() {
  const { state } = useGarden();
  const [pulse, setPulse] = useState(false);
  const prevCoins = useRef(state.coins);

  useEffect(() => {
    if (prevCoins.current === state.coins) return;
    prevCoins.current = state.coins;
    setPulse(false);
    const id = requestAnimationFrame(() => setPulse(true));
    return () => cancelAnimationFrame(id);
  }, [state.coins]);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-leaf">🌱</span>
        <span className="brand-name">Hydration Garden</span>
      </div>
      <div className="status">
        <div className="status-chip status-coins" title="Coins">
          <span className="chip-icon">🪙</span>
          <span id="coin-balance" className={pulse ? "pulse" : ""}>
            {state.coins.toLocaleString()}
          </span>
        </div>
        <div className="status-chip status-streak" title="Current streak">
          <span className="chip-icon">🔥</span>
          <span id="streak-count">{state.streak}</span>
        </div>
      </div>
    </header>
  );
}
