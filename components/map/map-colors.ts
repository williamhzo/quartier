import type maplibregl from "maplibre-gl";

export const CHOROPLETH_STOPS = [
  { value: 0, color: "#f7fbff" },
  { value: 20, color: "#c6dbef" },
  { value: 40, color: "#6baed6" },
  { value: 60, color: "#2171b5" },
  { value: 80, color: "#08519c" },
  { value: 100, color: "#08306b" },
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
