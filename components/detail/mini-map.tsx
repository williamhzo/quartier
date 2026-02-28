"use client";

import { useMemo } from "react";
import Map, { Layer, Source } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type maplibregl from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";

type Props = {
  boundaries: FeatureCollection<Geometry>;
  highlightNumber: number;
  center: { longitude: number; latitude: number };
};

export function MiniMap({ boundaries, highlightNumber, center }: Props) {
  const fillColor: maplibregl.ExpressionSpecification = useMemo(
    () => [
      "case",
      ["==", ["get", "number"], highlightNumber],
      "#2563eb",
      "#e2e8f0",
    ],
    [highlightNumber],
  );

  const fillOpacity: maplibregl.ExpressionSpecification = useMemo(
    () => ["case", ["==", ["get", "number"], highlightNumber], 0.7, 0.5],
    [highlightNumber],
  );

  const lineColor: maplibregl.ExpressionSpecification = useMemo(
    () => [
      "case",
      ["==", ["get", "number"], highlightNumber],
      "#1d4ed8",
      "#94a3b8",
    ],
    [highlightNumber],
  );

  const lineWidth: maplibregl.ExpressionSpecification = useMemo(
    () => ["case", ["==", ["get", "number"], highlightNumber], 2, 0.5],
    [highlightNumber],
  );

  return (
    <div className="h-48 w-full overflow-hidden">
      <Map
        initialViewState={{
          ...center,
          zoom: 11.5,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={{
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#ffffff" },
            },
          ],
        }}
        interactive={false}
        attributionControl={false}
      >
        <Source id="arrondissements" type="geojson" data={boundaries}>
          <Layer
            id="fill"
            type="fill"
            paint={{
              "fill-color": fillColor as unknown as string,
              "fill-opacity": fillOpacity as unknown as number,
            }}
          />
          <Layer
            id="outline"
            type="line"
            paint={{
              "line-color": lineColor as unknown as string,
              "line-width": lineWidth as unknown as number,
            }}
          />
        </Source>
      </Map>
    </div>
  );
}
