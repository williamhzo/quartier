import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadArrondissements } from "@/lib/data";
import { EQUAL_WEIGHTS } from "@/lib/personas";
import { computeComposite, rankByComposite } from "@/lib/scoring";
import { arrondissementSuffix } from "@/lib/arrondissements";
import { FRANCE_DATA_URI } from "../_france";

const size = { width: 1200, height: 630 };

const fontsDir = join(process.cwd(), "assets/fonts");
const fontRegularData = readFile(join(fontsDir, "Geist-Regular.ttf"));
const fontSemiBoldData = readFile(join(fontsDir, "Geist-SemiBold.ttf"));
const fontMonoSemiBoldData = readFile(join(fontsDir, "GeistMono-SemiBold.ttf"));

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const num = Number(number);

  if (isNaN(num) || num < 1 || num > 20) {
    return new Response("Not found", { status: 404 });
  }

  const [fontRegular, fontSemiBold, fontMonoSemiBold, data] = await Promise.all([
    fontRegularData,
    fontSemiBoldData,
    fontMonoSemiBoldData,
    loadArrondissements(),
  ]);

  const arr = data.find((a) => a.number === num);
  const suffix = arrondissementSuffix(num, "en");

  let composite = 0;
  let rank = 0;

  if (arr) {
    composite = Math.round(computeComposite(arr.scores, EQUAL_WEIGHTS));
    const ranked = rankByComposite(data, EQUAL_WEIGHTS);
    rank = ranked.find((a) => a.number === num)?.rank ?? 0;
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
        position: "relative",
        justifyContent: "center",
      }}
    >
      {/* France outline */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={FRANCE_DATA_URI}
        width={440}
        height={430}
        style={{
          position: "absolute",
          left: 380,
          top: 100,
        }}
      />

      {/* Top: bicolor brand */}
      <div style={{ display: "flex", position: "absolute", top: 48, left: 64 }}>
        <span
          style={{
            fontSize: 17,
            fontFamily: "GeistMono",
            fontWeight: 400,
            letterSpacing: "0.03em",
            color: "#0a0a0a",
          }}
        >
          quartier
        </span>
        <span
          style={{
            fontSize: 17,
            fontFamily: "GeistMono",
            fontWeight: 400,
            letterSpacing: "0.03em",
            color: "#c8c8c8",
          }}
        >
          .sh
        </span>
      </div>

      {/* Center: arrondissement + score */}
      <div
        style={{
          display: "flex",
          width: "100%",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        {/* Left: arrondissement name */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: 140,
                fontWeight: 600,
                color: "#0a0a0a",
                lineHeight: 0.9,
                letterSpacing: "-0.04em",
              }}
            >
              {num}
            </span>
            <span
              style={{
                fontSize: 48,
                fontWeight: 600,
                color: "#0a0a0a",
                lineHeight: 1,
                marginTop: 4,
              }}
            >
              {suffix}
            </span>
          </div>
          <span
            style={{
              fontSize: 30,
              fontWeight: 400,
              color: "#8a8a8a",
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
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span
                style={{
                  fontSize: 140,
                  fontWeight: 600,
                  color: "#0a0a0a",
                  lineHeight: 0.9,
                  letterSpacing: "-0.04em",
                }}
              >
                {composite}
              </span>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 400,
                  color: "#8a8a8a",
                  marginLeft: 4,
                }}
              >
                /100
              </span>
            </div>
            <span
              style={{
                fontSize: 30,
                fontWeight: 400,
                color: "#8a8a8a",
                marginTop: 8,
                letterSpacing: "0.01em",
              }}
            >
              #{rank} of 20
            </span>
          </div>
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
        {
          name: "GeistMono",
          data: fontMonoSemiBold,
          style: "normal" as const,
          weight: 600 as const,
        },
      ],
    },
  );
}
