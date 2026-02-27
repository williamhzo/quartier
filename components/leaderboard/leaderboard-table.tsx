"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
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
import { DIMENSION_KEYS, formatArrondissement } from "@/lib/arrondissements";
import type { Arrondissement, DimensionKey, PersonaKey } from "@/lib/types";
import { ArrowUpDown } from "lucide-react";

type SortKey = DimensionKey | "composite" | "number";

type Props = {
  data: Arrondissement[];
};

export function LeaderboardTable({ data }: Props) {
  const t = useTranslations();
  const [persona, setPersona] = useState<PersonaKey>("youngPro");
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
        av = a.scores[sortKey];
        bv = b.scores[sortKey];
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PersonaSelector value={persona} onChange={setPersona} />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">
                {t("leaderboard.rank")}
              </TableHead>
              <TableHead>
                <SortButton
                  active={sortKey === "number"}
                  onClick={() => toggleSort("number")}
                >
                  {t("leaderboard.arrondissement")}
                </SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton
                  active={sortKey === "composite"}
                  onClick={() => toggleSort("composite")}
                >
                  {t("dimensions.composite")}
                </SortButton>
              </TableHead>
              {DIMENSION_KEYS.map((key) => (
                <TableHead key={key} className="text-right">
                  <SortButton
                    active={sortKey === key}
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
                  className="text-muted-foreground h-24 text-center"
                >
                  {t("common.na")}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((a) => (
                <TableRow key={a.code}>
                  <TableCell className="text-muted-foreground text-center font-mono text-xs">
                    {a.rank}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/paris/${a.number}`}
                      className="hover:underline"
                    >
                      {formatArrondissement(a.number)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">
                      {Math.round(a.composite)}
                    </Badge>
                  </TableCell>
                  {DIMENSION_KEYS.map((key) => (
                    <TableCell
                      key={key}
                      className="text-muted-foreground text-right tabular-nums"
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

function SortButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 ${active ? "text-foreground" : ""}`}
    >
      {children}
      <ArrowUpDown className="size-3" />
    </button>
  );
}
