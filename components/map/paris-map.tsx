"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useQueryState, parseAsInteger } from "nuqs";
import { useTranslations, useLocale } from "next-intl";
import type { Arrondissement, DimensionKey, PersonaKey } from "@/lib/types";
import type { FeatureCollection, Geometry } from "geojson";
import { PERSONA_WEIGHTS } from "@/lib/personas";
import { rankByComposite } from "@/lib/scoring";
import { ordinalLabel } from "@/lib/arrondissements";
import { PersonaSelector } from "@/components/scoring/persona-selector";
import { DimensionSelect } from "@/components/scoring/dimension-select";
import { MapPanel } from "./map-panel";
import { MapLegend } from "./map-legend";
import { choroplethFillColor } from "./map-colors";

const PARIS_CENTER = { longitude: 2.3488, latitude: 48.8566 };
const INITIAL_ZOOM = 11.5;
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#fafafa" },
    },
  ],
};

type Props = {
  arrondissements: Arrondissement[];
  boundaries: FeatureCollection<Geometry>;
  contextBoundaries: FeatureCollection<Geometry>;
  seine: FeatureCollection<Geometry>;
};

export function ParisMap({
  arrondissements,
  boundaries,
  contextBoundaries,
  seine,
}: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const mapRef = useRef<MapRef>(null);
  const hoveredIdRef = useRef<number | null>(null);
  const [persona, setPersona] = useState<PersonaKey>("tourist");
  const [dimension, setDimension] = useState<DimensionKey | "composite">(
    "composite",
  );
  const [selectedNumber, setSelectedNumber] = useQueryState(
    "arr",
    parseAsInteger.withOptions({ history: "push", shallow: true }),
  );
  const tooltipRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => {
    setSelectedNumber(null);
  }, [setSelectedNumber]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedNumber != null) {
        closePanel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNumber, closePanel]);

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
            label: ordinalLabel(num, locale),
          },
        };
      }),
    };
  }, [boundaries, scoreMap, locale]);

  const selectedArrondissement = useMemo(
    () =>
      selectedNumber
        ? (ranked.find((a) => a.number === selectedNumber) ?? null)
        : null,
    [ranked, selectedNumber],
  );

  const [lastSelectedNumber, setLastSelectedNumber] = useState<number | null>(
    selectedNumber,
  );

  const displayArrondissement =
    selectedArrondissement ??
    (lastSelectedNumber != null
      ? (ranked.find((a) => a.number === lastSelectedNumber) ?? null)
      : null) ??
    ranked[0];

  const updateTooltip = useCallback(
    (num: number | null, x: number, y: number) => {
      const el = tooltipRef.current;
      if (!el) return;
      if (num == null) {
        el.style.display = "none";
        return;
      }
      const a = ranked.find((r) => r.number === num);
      const name = ordinalLabel(num, locale);
      const score =
        a != null
          ? dimension === "composite"
            ? a.composite
            : (a.scores[dimension] ?? null)
          : null;
      const dimLabel = t(
        dimension === "composite"
          ? "map.compositeScore"
          : `dimensions.${dimension}`,
      );
      el.style.display = "block";
      el.style.left = `${x + 12}px`;
      el.style.top = `${y - 12}px`;
      el.querySelector<HTMLElement>("[data-name]")!.textContent = name;
      const scoreEl = el.querySelector<HTMLElement>("[data-score]")!;
      if (score != null) {
        scoreEl.textContent = `${dimLabel}: ${Math.round(score)}`;
        scoreEl.style.display = "block";
      } else {
        scoreEl.style.display = "none";
      }
    },
    [ranked, dimension, locale, t],
  );

  const setHoverState = useCallback(
    (map: maplibregl.Map, id: number, hover: boolean) => {
      if (!map.getSource("arrondissements")) return;
      map.setFeatureState({ source: "arrondissements", id }, { hover });
    },
    [],
  );

  const onMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      if (e.features && e.features.length > 0) {
        const num = e.features[0].properties?.number as number | undefined;

        if (hoveredIdRef.current != null && hoveredIdRef.current !== num) {
          setHoverState(map, hoveredIdRef.current, false);
        }

        if (num != null) {
          setHoverState(map, num, true);
          hoveredIdRef.current = num;
        }

        map.getCanvas().style.cursor = num != null ? "pointer" : "grab";
        updateTooltip(num ?? null, e.point.x, e.point.y);
      } else {
        if (hoveredIdRef.current != null) {
          setHoverState(map, hoveredIdRef.current, false);
          hoveredIdRef.current = null;
        }
        map.getCanvas().style.cursor = "grab";
        updateTooltip(null, 0, 0);
      }
    },
    [setHoverState, updateTooltip],
  );

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map && hoveredIdRef.current != null) {
      setHoverState(map, hoveredIdRef.current, false);
      hoveredIdRef.current = null;
    }
    updateTooltip(null, 0, 0);
  }, [setHoverState, updateTooltip]);

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const num = e.features[0].properties?.number;
        if (typeof num === "number") {
          setLastSelectedNumber(num);
        }
        setSelectedNumber(num ?? null);
      } else {
        setSelectedNumber(null);
      }
    },
    [setSelectedNumber],
  );

  // Memoize paint expressions so they only change when selectedNumber changes,
  // not on every hover. Hover styling is handled via MapLibre feature-state.
  const fillOpacity = useMemo(
    () =>
      [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        0.9,
        selectedNumber != null
          ? ["case", ["==", ["get", "number"], selectedNumber], 0.85, 0.5]
          : 0.7,
      ] as maplibregl.ExpressionSpecification,
    [selectedNumber],
  );

  const lineColor = useMemo(
    () =>
      "#94a3b8" as maplibregl.ExpressionSpecification,
    [],
  );

  const lineWidth = useMemo(
    () =>
      [
        "case",
        ["==", ["get", "number"], selectedNumber ?? -1],
        2.25,
        ["boolean", ["feature-state", "hover"], false],
        1.2,
        0.36,
      ] as maplibregl.ExpressionSpecification,
    [selectedNumber],
  );

  const lineOpacity = useMemo(
    () =>
      [
        "case",
        ["==", ["get", "number"], selectedNumber ?? -1],
        0.9,
        ["boolean", ["feature-state", "hover"], false],
        0.8,
        0.58,
      ] as maplibregl.ExpressionSpecification,
    [selectedNumber],
  );

  const glowOpacity = useMemo(
    () =>
      [
        "case",
        ["==", ["get", "number"], selectedNumber ?? -1],
        0.15,
        0,
      ] as maplibregl.ExpressionSpecification,
    [selectedNumber],
  );

  return (
    <div className="relative h-[calc(100dvh-3.5rem)]">
      <div className="bg-background/90 ring-border/40 absolute top-3 left-3 z-10 flex flex-col gap-2 rounded-lg p-2 shadow-sm ring-1 backdrop-blur-sm">
        <div className="space-y-1">
          <p className="text-muted-foreground px-1 text-xs">
            {t("personas.label")}
          </p>
          <PersonaSelector value={persona} onChange={setPersona} />
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground px-1 text-xs">
            {t("map.dimensionsLabel")}
          </p>
          <DimensionSelect value={dimension} onChange={setDimension} />
        </div>
      </div>

      <Map
        ref={mapRef}
        initialViewState={{
          ...PARIS_CENTER,
          zoom: INITIAL_ZOOM,
        }}
        minZoom={11}
        maxZoom={15}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={["arrondissements-fill"]}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        cursor="grab"
        attributionControl={false}
      >
        <Source id="idf-context" type="geojson" data={contextBoundaries}>
          <Layer
            id="idf-context-fill"
            type="fill"
            paint={{
              "fill-color": "#f1f5f9",
              "fill-opacity": 0.5,
            }}
          />
          <Layer
            id="idf-context-outline"
            type="line"
            paint={{
              "line-color": "#cbd5e1",
              "line-width": 0.5,
              "line-opacity": 0.5,
            }}
          />
        </Source>
        <Source id="seine" type="geojson" data={seine}>
          <Layer
            id="seine-line"
            type="line"
            paint={{
              "line-color": "#93c5fd",
              "line-width": 2.5,
              "line-opacity": 0.5,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
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
              "fill-color": choroplethFillColor as unknown as string,
              "fill-opacity": fillOpacity as unknown as number,
            }}
          />
          <Layer
            id="arrondissements-glow"
            type="line"
            paint={{
              "line-color": "#1e293b",
              "line-width": 5,
              "line-opacity": glowOpacity as unknown as number,
              "line-blur": 3,
            }}
          />
          <Layer
            id="arrondissements-outline"
            type="line"
            paint={{
              "line-color": lineColor as unknown as string,
              "line-width": lineWidth as unknown as number,
              "line-opacity": lineOpacity as unknown as number,
            }}
          />
          <Layer
            id="arrondissements-labels"
            type="symbol"
            layout={{
              "text-field": ["get", "label"],
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11,
                11,
                13,
                14,
              ],
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

      <div
        ref={tooltipRef}
        role="tooltip"
        aria-live="polite"
        className="pointer-events-none absolute z-20"
        style={{ display: "none" }}
      >
        <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 shadow-md">
          <p className="text-sm font-medium" data-name />
          <p className="text-muted-foreground font-mono text-xs" data-score />
        </div>
      </div>

      <MapLegend
        dimension={dimension}
        selectedScore={
          selectedArrondissement
            ? dimension === "composite"
              ? selectedArrondissement.composite
              : (selectedArrondissement.scores[dimension] ?? null)
            : null
        }
      />

      <MapPanel
        arrondissement={displayArrondissement}
        allArrondissements={arrondissements}
        composite={displayArrondissement.composite}
        rank={displayArrondissement.rank}
        open={selectedArrondissement != null}
        onClose={closePanel}
      />
    </div>
  );
}
