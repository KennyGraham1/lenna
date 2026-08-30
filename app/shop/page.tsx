"use client";

import { PLANT_SETS } from "@/lib/plants";
import { isSetUnlocked, ownedCountInSet } from "@/lib/state";
import { useGarden } from "@/components/GardenProvider";

export default function ShopPage() {
  const { state, buy } = useGarden();

  return (
    <section className="screen">
      <div className="card">
        <h1>🛒 Plant shop</h1>
        <p className="muted">Buy plants with your coins. Complete a set to unlock the next one!</p>
      </div>

      <div className="shop-sets">
        {PLANT_SETS.map((set, idx) => {
          const unlocked = isSetUnlocked(state, idx);
          const ownedCount = ownedCountInSet(state, set);
          const total = set.plants.length;
          const pct = Math.round((ownedCount / total) * 100);

          return (
            <div key={set.id} className={`set-card ${unlocked ? "" : "locked"}`}>
              <div className="set-header">
                <h2>
                  Set {set.id}: {set.name} {unlocked ? "" : "🔒"}
                </h2>
                <span className="set-meta">
                  {ownedCount}/{total}
                </span>
              </div>
              <div className="set-progress">
                <div style={{ width: `${pct}%` }} />
              </div>
              {!unlocked && (
                <div className="set-locked-msg">Complete Set {set.id - 1} to unlock.</div>
              )}

              <div className="plants-grid">
                {set.plants.map((p) => {
                  const owned = !!state.owned[p.id];
                  const affordable = state.coins >= p.price;
                  return (
                    <div
                      key={p.id}
                      className={`plant-card ${owned ? "owned" : ""} ${unlocked ? "" : "locked"}`}
                    >
                      <span className="plant-icon">{p.icon}</span>
                      <div className="plant-name">{p.name}</div>
                      <div className="plant-price">{p.price.toLocaleString()} 🪙</div>
                      {owned ? (
                        <span className="owned-badge">Owned ✓</span>
                      ) : (
                        <button
                          disabled={!unlocked || !affordable}
                          onClick={() => buy(p.id)}
                        >
                          {!unlocked ? "Locked" : affordable ? "Buy" : "Not enough"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
