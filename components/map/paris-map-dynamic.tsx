"use client";

import dynamic from "next/dynamic";
import type { ParisMap } from "./paris-map";

export const ParisMapDynamic = dynamic(
  () => import("./paris-map").then((m) => m.ParisMap),
  { ssr: false },
) as typeof ParisMap;
