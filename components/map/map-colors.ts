import type maplibregl from "maplibre-gl";

export const CHOROPLETH_STOPS = [
  { value: 0, color: "#f0f4f8" },
  { value: 20, color: "#b8d4e3" },
  { value: 40, color: "#5ba3b5" },
  { value: 60, color: "#2b7a8e" },
  { value: 80, color: "#1a5566" },
  { value: 100, color: "#0c3547" },
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
