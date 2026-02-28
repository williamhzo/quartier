import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadArrondissements } from "@/lib/data";
import { EQUAL_WEIGHTS } from "@/lib/personas";
import { computeComposite, rankByComposite } from "@/lib/scoring";
import { DIMENSION_KEYS, formatArrondissement } from "@/lib/arrondissements";
import type { DimensionKey } from "@/lib/types";

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  housing: "Housing",
  income: "Income",
  safety: "Safety",
  transport: "Transport",
  nightlife: "Nightlife",
  greenSpace: "Green Space",
  noise: "Noise",
  amenities: "Amenities",
};

const size = { width: 1200, height: 630 };

const fontsDir = join(process.cwd(), "assets/fonts");
const fontRegularData = readFile(join(fontsDir, "Geist-Regular.ttf"));
const fontSemiBoldData = readFile(join(fontsDir, "Geist-SemiBold.ttf"));

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const num = Number(number);

  if (isNaN(num) || num < 1 || num > 20) {
    return new Response("Not found", { status: 404 });
  }

  const [fontRegular, fontSemiBold, data] = await Promise.all([
    fontRegularData,
    fontSemiBoldData,
    loadArrondissements(),
  ]);

  const arr = data.find((a) => a.number === num);
  const label = formatArrondissement(num);

  let composite = 0;
  let rank = 0;
  let topDimensions: { key: DimensionKey; label: string; score: number }[] = [];

  if (arr) {
    composite = Math.round(computeComposite(arr.scores, EQUAL_WEIGHTS));
    const ranked = rankByComposite(data, EQUAL_WEIGHTS);
    rank = ranked.find((a) => a.number === num)?.rank ?? 0;

    topDimensions = DIMENSION_KEYS.map((k) => ({
      key: k as DimensionKey,
      label: DIMENSION_LABELS[k as DimensionKey],
      score: arr.scores[k as DimensionKey] ?? -1,
    }))
      .filter((d) => d.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fafafa",
        fontFamily: "Geist",
        padding: "48px 64px",
        justifyContent: "space-between",
      }}
    >
      {/* Top: brand */}
      <div style={{ display: "flex" }}>
        <span
          style={{
            fontSize: 17,
            fontWeight: 400,
            color: "#a3a3a3",
            letterSpacing: "0.03em",
          }}
        >
          quartier.sh
        </span>
      </div>

      {/* Center: arrondissement + score */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        {/* Left: arrondissement name */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 140,
              fontWeight: 600,
              color: "#0a0a0a",
              lineHeight: 0.9,
              letterSpacing: "-0.04em",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: 30,
              fontWeight: 400,
              color: "#a3a3a3",
              marginTop: 8,
              letterSpacing: "0.01em",
            }}
          >
            arrondissement
          </span>
        </div>

        {/* Right: composite score */}
        {arr && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              paddingBottom: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span
                style={{
                  fontSize: 88,
                  fontWeight: 600,
                  color: "#0a0a0a",
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                }}
              >
                {composite}
              </span>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 400,
                  color: "#d4d4d4",
                  marginLeft: 4,
                }}
              >
                /100
              </span>
            </div>
            <span
              style={{
                fontSize: 20,
                fontWeight: 400,
                color: "#a3a3a3",
                marginTop: 4,
              }}
            >
              #{rank} of 20
            </span>
          </div>
        )}
      </div>

      {/* Bottom: dimension pills */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {topDimensions.length > 0 &&
          topDimensions.map((d) => (
            <div
              key={d.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                backgroundColor: "#ebebeb",
                borderRadius: 8,
                padding: "10px 18px",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 400, color: "#737373" }}>
                {d.label}
              </span>
              <span style={{ fontSize: 18, fontWeight: 600, color: "#262626" }}>
                {Math.round(d.score)}
              </span>
            </div>
          ))}

        {topDimensions.length === 0 && (
          <span style={{ fontSize: 16, fontWeight: 400, color: "#a3a3a3" }}>
            Data coming soon
          </span>
        )}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Geist",
          data: fontRegular,
          style: "normal" as const,
          weight: 400 as const,
        },
        {
          name: "Geist",
          data: fontSemiBold,
          style: "normal" as const,
          weight: 600 as const,
        },
      ],
    },
  );
}
