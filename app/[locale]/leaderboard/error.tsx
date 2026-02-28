"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/components/error-card";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function LeaderboardError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorCard reset={reset} backHref="/" />;
}
