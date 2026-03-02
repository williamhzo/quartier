import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FRANCE_DATA_URI } from "./_france";

const size = { width: 1200, height: 630 };

const fontsDir = join(process.cwd(), "assets/fonts");
const fontRegularData = readFile(join(fontsDir, "Geist-Regular.ttf"));
const fontSemiBoldData = readFile(join(fontsDir, "Geist-SemiBold.ttf"));
const fontMonoSemiBoldData = readFile(join(fontsDir, "GeistMono-SemiBold.ttf"));

export async function GET() {
  const [fontRegular, fontSemiBold, fontMonoSemiBold] = await Promise.all([
    fontRegularData,
    fontSemiBoldData,
    fontMonoSemiBoldData,
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
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={FRANCE_DATA_URI}
        width={512}
        height={500}
        style={{
          position: "absolute",
          right: 40,
          top: 65,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex" }}>
          <span
            style={{
              fontSize: 96,
              fontWeight: 600,
              fontFamily: "GeistMono",
              color: "#0a0a0a",
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
            }}
          >
            quartier
          </span>
          <span
            style={{
              fontSize: 96,
              fontWeight: 600,
              fontFamily: "GeistMono",
              color: "#c8c8c8",
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
            }}
          >
            .sh
          </span>
        </div>
        <span
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: "#8a8a8a",
            marginTop: 16,
            letterSpacing: "0.01em",
          }}
        >
          {"Explore the data behind Paris's 20 arrondissements"}
        </span>
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
