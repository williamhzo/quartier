import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const size = { width: 1200, height: 630 };

const fontsDir = join(process.cwd(), "assets/fonts");
const fontRegularData = readFile(join(fontsDir, "Geist-Regular.ttf"));
const fontSemiBoldData = readFile(join(fontsDir, "Geist-SemiBold.ttf"));

export async function GET() {
  const [fontRegular, fontSemiBold] = await Promise.all([
    fontRegularData,
    fontSemiBoldData,
  ]);

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

      {/* Center: hero */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: 96,
            fontWeight: 600,
            color: "#0a0a0a",
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
          }}
        >
          quartier
        </span>
        <span
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: "#a3a3a3",
            marginTop: 16,
            letterSpacing: "0.01em",
          }}
        >
          {"Compare Paris\u2019s 20 arrondissements"}
        </span>
      </div>

      {/* Bottom: dimension tags */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {[
          "Housing",
          "Income",
          "Safety",
          "Transport",
          "Nightlife",
          "Green Space",
          "Noise",
          "Amenities",
          "Culture",
          "Sports",
        ].map((label) => (
          <div
            key={label}
            style={{
              display: "flex",
              backgroundColor: "#ebebeb",
              borderRadius: 8,
              padding: "8px 16px",
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 400, color: "#737373" }}>
              {label}
            </span>
          </div>
        ))}
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
