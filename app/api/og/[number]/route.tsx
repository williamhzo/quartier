import { ImageResponse } from "@vercel/og";
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
  greenSpace: "Green space",
  noise: "Noise",
  amenities: "Amenities",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const num = Number(number);

  if (isNaN(num) || num < 1 || num > 20) {
    return new Response("Not found", { status: 404 });
  }

  const data = await loadArrondissements();
  const arr = data.find((a) => a.number === num);

  const label = formatArrondissement(num);
  let composite = 0;
  let rank = 0;
  let topDimensions: { key: DimensionKey; score: number }[] = [];

  if (arr) {
    composite = Math.round(computeComposite(arr.scores, EQUAL_WEIGHTS));
    const ranked = rankByComposite(data, EQUAL_WEIGHTS);
    rank = ranked.find((a) => a.number === num)?.rank ?? 0;

    topDimensions = DIMENSION_KEYS.map((k) => ({
      key: k as DimensionKey,
      score: arr.scores[k as DimensionKey] ?? 0,
    }))
      .filter((d) => d.score > 0)
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
        justifyContent: "center",
        padding: "60px",
        backgroundColor: "#fafafa",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "16px",
        }}
      >
        <span style={{ fontSize: 72, fontWeight: 700, color: "#0f172a" }}>
          {label}
        </span>
        {arr && (
          <span style={{ fontSize: 32, color: "#64748b" }}>#{rank}/20</span>
        )}
      </div>

      {arr ? (
        <div
          style={{ display: "flex", flexDirection: "column", marginTop: 32 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: 48, fontWeight: 600, color: "#0f172a" }}>
              {composite}
            </span>
            <span style={{ fontSize: 24, color: "#94a3b8" }}>/100</span>
          </div>

          <div style={{ display: "flex", gap: "24px", marginTop: 32 }}>
            {topDimensions.map((d) => (
              <div
                key={d.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "#f1f5f9",
                  borderRadius: 12,
                  padding: "16px 24px",
                }}
              >
                <span style={{ fontSize: 16, color: "#64748b" }}>
                  {DIMENSION_LABELS[d.key]}
                </span>
                <span
                  style={{ fontSize: 28, fontWeight: 600, color: "#0f172a" }}
                >
                  {Math.round(d.score)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", marginTop: 32 }}>
          <span style={{ fontSize: 24, color: "#94a3b8" }}>
            Data coming soon
          </span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: 40,
          right: 60,
        }}
      >
        <span style={{ fontSize: 20, color: "#94a3b8", fontWeight: 500 }}>
          quartier.sh
        </span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
