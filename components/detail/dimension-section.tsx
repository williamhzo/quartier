"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBar } from "./score-bar";
import type { Arrondissement, DimensionKey } from "@/lib/types";

type Props = {
  dimensionKey: DimensionKey;
  arrondissement: Arrondissement;
};

export function DimensionSection({ dimensionKey, arrondissement }: Props) {
  const t = useTranslations();
  const score = arrondissement.scores[dimensionKey];
  const dim = arrondissement.dimensions[dimensionKey];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {t(`dimensions.${dimensionKey}`)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreBar
          score={score ?? 0}
          label={t("detail.scores")}
        />
        <RawValues dimensionKey={dimensionKey} data={dim} />
      </CardContent>
    </Card>
  );
}

function RawValues({
  dimensionKey,
  data,
}: {
  dimensionKey: DimensionKey;
  data: Arrondissement["dimensions"][DimensionKey];
}) {
  const t = useTranslations("detail");

  if (!data) return null;

  const rows = getRawValueRows(dimensionKey, data, t);

  return (
    <dl className="text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between py-1">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function getRawValueRows(
  key: DimensionKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any,
): [string, string][] {
  switch (key) {
    case "housing":
      return [
        [t("housing.medianPrice"), `${fmt(data.median_price_m2)} EUR/m²`],
        [t("housing.yoyChange"), `${data.yoy_change > 0 ? "+" : ""}${data.yoy_change?.toFixed(1)}%`],
        [t("housing.transactions"), fmt(data.transaction_count)],
      ];
    case "income":
      return [
        [t("income.medianHousehold"), `${fmt(data.median_household)} EUR`],
        [t("income.povertyRate"), `${data.poverty_rate?.toFixed(1)}%`],
      ];
    case "safety":
      return [
        [t("safety.crimeRate"), data.crime_rate_per_1k?.toFixed(1)],
      ];
    case "transport":
      return [
        [t("transport.stationsPerKm2"), data.stations_per_km2?.toFixed(1)],
        [t("transport.metroLines"), data.metro_lines?.join(", ") ?? "-"],
      ];
    case "nightlife":
      return [
        [t("nightlife.restaurantsPerKm2"), data.restaurants_per_km2?.toFixed(1)],
        [t("nightlife.barsPerKm2"), data.bars_per_km2?.toFixed(1)],
        [t("nightlife.cafesPerKm2"), data.cafes_per_km2?.toFixed(1)],
      ];
    case "greenSpace":
      return [
        [t("greenSpace.m2PerResident"), data.m2_per_resident?.toFixed(1)],
        [t("greenSpace.parkCount"), String(data.park_count ?? "-")],
      ];
    case "noise":
      return [
        [t("noise.dayExposure"), `${data.pct_above_lden_threshold?.toFixed(1)}%`],
        [t("noise.nightExposure"), `${data.pct_above_night_threshold?.toFixed(1)}%`],
      ];
    case "amenities":
      return [
        [t("amenities.pharmacies"), String(data.pharmacies ?? "-")],
        [t("amenities.doctors"), String(data.doctors ?? "-")],
        [t("amenities.schools"), String(data.schools ?? "-")],
        [t("amenities.gyms"), String(data.gyms ?? "-")],
        [t("amenities.cinemas"), String(data.cinemas ?? "-")],
      ];
    default:
      return [];
  }
}

function fmt(n: number | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}
