"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { PersonaSelector } from "@/components/scoring/persona-selector";
import { PERSONA_WEIGHTS } from "@/lib/personas";
import { rankByComposite } from "@/lib/scoring";
import { DIMENSION_KEYS } from "@/lib/arrondissements";
import { ArrondissementLabel } from "@/components/arrondissement-label";
import type { Arrondissement, DimensionKey, PersonaKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";

type SortKey = DimensionKey | "composite" | "number";

type Props = {
  data: Arrondissement[];
};

export function LeaderboardTable({ data }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [persona, setPersona] = useState<PersonaKey>("tourist");
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortAsc, setSortAsc] = useState(false);

  const weights = PERSONA_WEIGHTS[persona];
  const ranked = useMemo(() => rankByComposite(data, weights), [data, weights]);

  const sorted = useMemo(() => {
    const list = [...ranked];
    list.sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "composite") {
        av = a.composite;
        bv = b.composite;
      } else if (sortKey === "number") {
        av = a.number;
        bv = b.number;
      } else {
        av = a.scores[sortKey] ?? 0;
        bv = b.scores[sortKey] ?? 0;
      }
      return sortAsc ? av - bv : bv - av;
    });
    return list;
  }, [ranked, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const colHighlight = "bg-primary/[0.04] dark:bg-primary/[0.06]";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PersonaSelector value={persona} onChange={setPersona} />
      </div>
      <div className="overflow-clip rounded-lg border">
        <Table aria-label={t("leaderboard.tableLabel")}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="bg-background sticky left-0 z-10 w-12 border-b text-center">
                {t("leaderboard.rank")}
              </TableHead>
              <TableHead
                className="bg-background sticky left-12 z-10 border-r border-b"
                aria-sort={sortKey === "number" ? (sortAsc ? "ascending" : "descending") : "none"}
              >
                <SortButton
                  active={sortKey === "number"}
                  asc={sortAsc}
                  onClick={() => toggleSort("number")}
                >
                  {t("leaderboard.arrondissement")}
                </SortButton>
              </TableHead>
              <TableHead
                className={cn(
                  "text-right",
                  sortKey === "composite" && colHighlight,
                )}
                aria-sort={sortKey === "composite" ? (sortAsc ? "ascending" : "descending") : "none"}
              >
                <SortButton
                  active={sortKey === "composite"}
                  asc={sortAsc}
                  onClick={() => toggleSort("composite")}
                >
                  {t("dimensions.composite")}
                </SortButton>
              </TableHead>
              {DIMENSION_KEYS.map((key) => (
                <TableHead
                  key={key}
                  className={cn(
                    "text-right",
                    sortKey === key && colHighlight,
                  )}
                  aria-sort={sortKey === key ? (sortAsc ? "ascending" : "descending") : "none"}
                >
                  <SortButton
                    active={sortKey === key}
                    asc={sortAsc}
                    onClick={() => toggleSort(key)}
                  >
                    {t(`dimensions.${key}`)}
                  </SortButton>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3 + DIMENSION_KEYS.length}
                  className="h-48 text-center"
                >
                  <div className="text-muted-foreground space-y-1">
                    <p className="text-sm font-medium">
                      {t("leaderboard.emptyTitle")}
                    </p>
                    <p className="text-xs">
                      {t("leaderboard.emptyDescription")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((a, i) => (
                <TableRow key={a.code} className={cn(i % 2 === 1 && "bg-muted/30")}>
                  <TableCell className={cn("sticky left-0 z-10 text-center font-mono text-xs", i % 2 === 1 ? "bg-muted/30" : "bg-background")}>
                    <RankBadge rank={a.rank} />
                  </TableCell>
                  <TableCell className={cn("sticky left-12 z-10 border-r font-medium", i % 2 === 1 ? "bg-muted/30" : "bg-background")}>
                    <Link
                      href={`/paris/${a.number}`}
                      className="hover:text-primary transition-colors hover:underline"
                    >
                      <ArrondissementLabel number={a.number} locale={locale} />
                    </Link>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      sortKey === "composite" && colHighlight,
                    )}
                  >
                    <Badge variant={a.rank <= 3 ? "default" : "secondary"} className="font-mono">
                      {Math.round(a.composite)}
                    </Badge>
                  </TableCell>
                  {DIMENSION_KEYS.map((key) => (
                    <TableCell
                      key={key}
                      className={cn(
                        "text-right font-mono tabular-nums",
                        sortKey === key
                          ? cn(colHighlight, "text-foreground")
                          : "text-muted-foreground",
                      )}
                    >
                      {a.scores[key] != null ? Math.round(a.scores[key]) : "-"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const styles = [
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-300",
      "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
    ];
    return (
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full font-mono text-xs font-semibold",
          styles[rank - 1],
        )}
      >
        {rank}
      </span>
    );
  }
  return <span className="font-mono text-muted-foreground">{rank}</span>;
}

function SortButton({
  children,
  active,
  asc,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  const Icon = active ? (asc ? ChevronUp : ChevronDown) : ArrowUpDown;
  return (
    <button
      onClick={onClick}
      className={cn(
        "-mx-1.5 -my-0.5 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted/50",
        active
          ? "text-foreground font-semibold"
          : "text-muted-foreground hover:text-foreground/70",
      )}
    >
      {children}
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          active ? "text-primary" : "opacity-20",
        )}
      />
    </button>
  );
}
