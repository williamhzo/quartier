import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
        borderRadius: 40,
      }}
    >
      <span
        style={{
          fontSize: 110,
          fontWeight: 600,
          color: "#fafafa",
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        q
      </span>
    </div>,
    { ...size },
  );
}
