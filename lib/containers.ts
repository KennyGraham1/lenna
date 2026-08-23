/* Container presets for estimating a drink without a photo or a network call. */

export type Container = { id: string; label: string; icon: string; ml: number };

// Capacities are the common real-world sizes the log screen already assumes.
export const CONTAINERS: Container[] = [
  { id: "teacup", label: "Teacup", icon: "🍵", ml: 200 },
  { id: "glass", label: "Glass", icon: "🥛", ml: 250 },
  { id: "can", label: "Can", icon: "🥤", ml: 330 },
  { id: "mug", label: "Mug", icon: "☕", ml: 350 },
  { id: "bottle", label: "Bottle", icon: "💧", ml: 500 },
  { id: "pint", label: "Pint", icon: "🍺", ml: 570 },
  { id: "large", label: "Big bottle", icon: "🚰", ml: 750 },
  { id: "litre", label: "1 L bottle", icon: "🫙", ml: 1000 }
];

// Same 10-1500 mL bounds the manual field enforces, rounded to the nearest 10.
export function estimateMl(capacityMl: number, fillPercent: number) {
  const raw = (capacityMl * fillPercent) / 100;
  return Math.min(1500, Math.max(0, Math.round(raw / 10) * 10));
}

export function fillLabel(percent: number) {
  if (percent >= 98) return "Full";
  if (percent >= 72) return "Three-quarters";
  if (percent >= 55) return "Two-thirds";
  if (percent >= 45) return "Half";
  if (percent >= 28) return "A third";
  if (percent >= 12) return "A quarter";
  if (percent > 0) return "A sip";
  return "Empty";
}
