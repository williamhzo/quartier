"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import type { Arrondissement, DimensionKey, PersonaKey } from "@/lib/types";
import type { FeatureCollection, Geometry } from "geojson";
import { PERSONA_WEIGHTS } from "@/lib/personas";
import { rankByComposite } from "@/lib/scoring";
import { formatArrondissement } from "@/lib/arrondissements";
import { PersonaSelector } from "@/components/scoring/persona-selector";
import { DimensionSelect } from "@/components/scoring/dimension-select";
import { MapTooltip } from "./map-tooltip";
import { MapPanel } from "./map-panel";

const PARIS_CENTER = { longitude: 2.3488, latitude: 48.8566 };
const INITIAL_ZOOM = 11.5;

type Props = {
  arrondissements: Arrondissement[];
  boundaries: FeatureCollection<Geometry>;
  contextBoundaries: FeatureCollection<Geometry>;
};

export function ParisMap({
  arrondissements,
  boundaries,
  contextBoundaries,
}: Props) {
  const t = useTranslations();
  const mapRef = useRef<MapRef>(null);
  const hoveredIdRef = useRef<number | null>(null);
  const [persona, setPersona] = useState<PersonaKey>("youngPro");
  const [dimension, setDimension] = useState<DimensionKey | "composite">(
    "composite",
  );
  const [hoveredNumber, setHoveredNumber] = useState<number | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const weights = PERSONA_WEIGHTS[persona];
  const ranked = useMemo(
    () => rankByComposite(arrondissements, weights),
    [arrondissements, weights],
  );

  const scoreMap = useMemo(() => {
    const scores = new globalThis.Map<number, number>();
    for (const a of ranked) {
      if (dimension === "composite") {
        scores.set(a.number, a.composite);
      } else {
        const score = a.scores[dimension];
        if (score != null) scores.set(a.number, score);
      }
    }
    return scores;
  }, [ranked, dimension]);

  const enrichedGeojson = useMemo(() => {
    return {
      ...boundaries,
      features: boundaries.features.map((f) => {
        const num = f.properties?.c_ar as number;
        const score = scoreMap.get(num) ?? null;
        return {
          ...f,
          properties: {
            ...f.properties,
            score,
            number: num,
            label: formatArrondissement(num),
          },
        };
      }),
    };
  }, [boundaries, scoreMap]);

  const selectedArrondissement = useMemo(
    () =>
      selectedNumber
        ? (ranked.find((a) => a.number === selectedNumber) ?? null)
        : null,
    [ranked, selectedNumber],
  );

  const hoveredInfo = useMemo(() => {
    if (hoveredNumber == null) return null;
    const a = ranked.find((r) => r.number === hoveredNumber);
    if (!a) {
      return {
        name: formatArrondissement(hoveredNumber),
        score: null,
      };
    }
    return {
      name: formatArrondissement(a.number),
      score:
        dimension === "composite" ? a.composite : (a.scores[dimension] ?? null),
    };
  }, [ranked, hoveredNumber, dimension]);

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (e.features && e.features.length > 0) {
      const num = e.features[0].properties?.number as number | undefined;

      if (hoveredIdRef.current != null && hoveredIdRef.current !== num) {
        map.setFeatureState(
          { source: "arrondissements", id: hoveredIdRef.current },
          { hover: false },
        );
      }

      if (num != null) {
        map.setFeatureState(
          { source: "arrondissements", id: num },
          { hover: true },
        );
        hoveredIdRef.current = num;
      }

      setHoveredNumber(num ?? null);
      setTooltipPos({ x: e.point.x, y: e.point.y });
    } else {
      if (hoveredIdRef.current != null) {
        map.setFeatureState(
          { source: "arrondissements", id: hoveredIdRef.current },
          { hover: false },
        );
        hoveredIdRef.current = null;
      }
      setHoveredNumber(null);
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map && hoveredIdRef.current != null) {
      map.setFeatureState(
        { source: "arrondissements", id: hoveredIdRef.current },
        { hover: false },
      );
      hoveredIdRef.current = null;
    }
    setHoveredNumber(null);
  }, []);

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
      const num = e.features[0].properties?.number;
      setSelectedNumber(num ?? null);
    } else {
      setSelectedNumber(null);
    }
  }, []);

  const fillColor: maplibregl.ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "score"], 0],
    0,
    "#f7fbff",
    20,
    "#c6dbef",
    40,
    "#6baed6",
    60,
    "#2171b5",
    80,
    "#08519c",
    100,
    "#08306b",
  ];

  // Memoize paint expressions so they only change when selectedNumber changes,
  // not on every hover. Hover styling is handled via MapLibre feature-state.
  const fillOpacity = useMemo(
    () =>
      [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        0.9,
        selectedNumber != null
          ? [
              "case",
              ["==", ["get", "number"], selectedNumber],
              0.85,
              0.6,
            ]
          : 0.7,
      ] as maplibregl.ExpressionSpecification,
    [selectedNumber],
  );

  const lineColor = useMemo(
    () =>
      [
        "case",
        ["==", ["get", "number"], selectedNumber ?? -1],
        "#1e293b",
        "#64748b",
      ] as maplibregl.ExpressionSpecification,
    [selectedNumber],
  );

  const lineWidth = useMemo(
    () =>
      [
        "case",
        ["==", ["get", "number"], selectedNumber ?? -1],
        2.5,
        ["boolean", ["feature-state", "hover"], false],
        1.5,
        0.8,
      ] as maplibregl.ExpressionSpecification,
    [selectedNumber],
  );

  return (
    <div className="relative h-[calc(100vh-3.5rem)]">
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <div className="w-40">
          <DimensionSelect value={dimension} onChange={setDimension} />
        </div>
        <div className="w-40">
          <PersonaSelector value={persona} onChange={setPersona} />
        </div>
      </div>

      <Map
        ref={mapRef}
        initialViewState={{
          ...PARIS_CENTER,
          zoom: INITIAL_ZOOM,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={{
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#f0f0f0" },
            },
          ],
        }}
        interactiveLayerIds={["arrondissements-fill"]}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        cursor={hoveredNumber ? "pointer" : "grab"}
      >
        <Source id="idf-context" type="geojson" data={contextBoundaries}>
          <Layer
            id="idf-context-fill"
            type="fill"
            paint={{
              "fill-color": "#e8e8e8",
              "fill-opacity": 0.6,
            }}
          />
          <Layer
            id="idf-context-outline"
            type="line"
            paint={{
              "line-color": "#c0c0c0",
              "line-width": 0.5,
            }}
          />
        </Source>

        <Source
          id="arrondissements"
          type="geojson"
          data={enrichedGeojson}
          promoteId="number"
        >
          <Layer
            id="arrondissements-fill"
            type="fill"
            paint={{
              "fill-color": fillColor as unknown as string,
              "fill-opacity": fillOpacity as unknown as number,
            }}
          />
          <Layer
            id="arrondissements-outline"
            type="line"
            paint={{
              "line-color": lineColor as unknown as string,
              "line-width": lineWidth as unknown as number,
            }}
          />
          <Layer
            id="arrondissements-labels"
            type="symbol"
            layout={{
              "text-field": ["get", "label"],
              "text-size": 12,
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-allow-overlap": true,
            }}
            paint={{
              "text-color": "#1e293b",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.5,
            }}
          />
        </Source>
      </Map>

      {hoveredInfo && (
        <MapTooltip
          x={tooltipPos.x}
          y={tooltipPos.y}
          name={hoveredInfo.name}
          score={hoveredInfo.score}
          dimensionLabel={t(
            dimension === "composite"
              ? "map.compositeScore"
              : `dimensions.${dimension}`,
          )}
        />
      )}

      {selectedArrondissement && (
        <MapPanel
          arrondissement={selectedArrondissement}
          composite={selectedArrondissement.composite}
          rank={selectedArrondissement.rank}
          weights={weights}
          onClose={() => setSelectedNumber(null)}
        />
      )}

    </div>
  );
}
