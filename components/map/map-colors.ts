import type maplibregl from "maplibre-gl";

export const CHOROPLETH_STOPS = [
  { value: 0, color: "#eff6ff" },
  { value: 20, color: "#bfdbfe" },
  { value: 40, color: "#60a5fa" },
  { value: 60, color: "#2563eb" },
  { value: 80, color: "#1e40af" },
  { value: 100, color: "#172554" },
] as const;

export const choroplethFillColor: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "score"], 0],
  ...CHOROPLETH_STOPS.flatMap((s) => [s.value, s.color]),
];

export const choroplethGradientCSS = `linear-gradient(to right, ${CHOROPLETH_STOPS.map(
  (s) => `${s.color} ${s.value}%`,
).join(", ")})`;
