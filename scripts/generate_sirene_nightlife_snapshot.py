#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import duckdb
except ImportError as exc:  # pragma: no cover - operator guidance
    raise SystemExit(
        "duckdb is required for SIRENE parquet processing. Install it with "
        "`python3 -m pip install -r scripts/requirements-sirene.txt`."
    ) from exc


PARIS_COMMUNES = [
    "75101",
    "75102",
    "75103",
    "75104",
    "75105",
    "75106",
    "75107",
    "75108",
    "75109",
    "75110",
    "75111",
    "75112",
    "75113",
    "75114",
    "75115",
    "75116",
    "75117",
    "75118",
    "75119",
    "75120",
]

RESTAURANT_CODES = ["56.10A", "56.10B", "56.10C"]
BARS_CAFES_CODES = ["56.30Z"]
NIGHTLIFE_EXTENSION_CODES = ["93.29Z"]


@dataclass(frozen=True)
class ArrondissementContext:
    code: str
    number: int
    name: str
    area_km2: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate tracked nightlife snapshot from SIRENE stock parquet."
    )
    parser.add_argument(
        "--stock",
        default="data/raw/sirene/StockEtablissement_utf8.parquet",
        help="Path to StockEtablissement parquet",
    )
    parser.add_argument(
        "--areas",
        default="data/arrondissements.json",
        help="Path to tracked arrondissement dataset used for area_km2",
    )
    parser.add_argument(
        "--out",
        default="data/nightlife-snapshot.json",
        help="Output path for derived nightlife snapshot",
    )
    return parser.parse_args()


def load_arrondissement_contexts(path: Path) -> list[ArrondissementContext]:
    payload = json.loads(path.read_text())
    contexts: list[ArrondissementContext] = []

    for row in payload:
        contexts.append(
            ArrondissementContext(
                code=str(row["code"]),
                number=int(row["number"]),
                name=str(row["name"]),
                area_km2=float(row["area_km2"]),
            )
        )

    contexts.sort(key=lambda item: item.number)
    if [item.code for item in contexts] != PARIS_COMMUNES:
        raise SystemExit("area source does not match expected Paris communes")

    return contexts


def sql_in_list(values: list[str]) -> str:
    quoted = ", ".join(f"'{value}'" for value in values)
    return f"({quoted})"


def round2(value: float) -> float:
    return round(value + 1e-12, 2)


def build_snapshot(
    stock_path: Path,
    arrondissement_contexts: list[ArrondissementContext],
) -> dict[str, Any]:
    connection = duckdb.connect(database=":memory:")
    try:
        commune_sql = sql_in_list(PARIS_COMMUNES)
        restaurants_sql = sql_in_list(RESTAURANT_CODES)
        bars_sql = sql_in_list(BARS_CAFES_CODES)
        extension_sql = sql_in_list(NIGHTLIFE_EXTENSION_CODES)

        aggregate_query = f"""
          WITH filtered AS (
            SELECT
              codeCommuneEtablissement AS commune_code,
              activitePrincipaleEtablissement AS ape_code
            FROM read_parquet('{stock_path.as_posix()}')
            WHERE codeCommuneEtablissement IN {commune_sql}
              AND etatAdministratifEtablissement = 'A'
              AND nomenclatureActivitePrincipaleEtablissement = 'NAFRev2'
          )
          SELECT
            commune_code,
            COUNT(*) AS active_establishments_total,
            SUM(CASE WHEN ape_code IN {restaurants_sql} THEN 1 ELSE 0 END) AS restaurants_count,
            SUM(CASE WHEN ape_code IN {bars_sql} THEN 1 ELSE 0 END) AS bars_cafes_count,
            SUM(CASE WHEN ape_code IN {extension_sql} THEN 1 ELSE 0 END) AS nightlife_extension_count
          FROM filtered
          GROUP BY commune_code
          ORDER BY commune_code
        """
        summary_query = f"""
          WITH filtered AS (
            SELECT
              codeCommuneEtablissement AS commune_code,
              activitePrincipaleEtablissement AS ape_code
            FROM read_parquet('{stock_path.as_posix()}')
            WHERE codeCommuneEtablissement IN {commune_sql}
              AND etatAdministratifEtablissement = 'A'
              AND nomenclatureActivitePrincipaleEtablissement = 'NAFRev2'
          )
          SELECT
            COUNT(*) AS active_establishments_total,
            SUM(CASE WHEN ape_code IN {restaurants_sql} THEN 1 ELSE 0 END) AS restaurants_count_total,
            SUM(CASE WHEN ape_code IN {bars_sql} THEN 1 ELSE 0 END) AS bars_cafes_count_total,
            SUM(CASE WHEN ape_code IN {extension_sql} THEN 1 ELSE 0 END) AS nightlife_extension_count_total
          FROM filtered
        """

        rows = connection.execute(aggregate_query).fetchall()
        summary_row = connection.execute(summary_query).fetchone()

        if summary_row is None:
            raise SystemExit("failed to compute SIRENE nightlife summary")

        by_commune = {str(row[0]): row for row in rows}
        arrondissements: list[dict[str, Any]] = []
        for context in arrondissement_contexts:
            row = by_commune.get(context.code)
            if row is None:
                raise SystemExit(f"missing SIRENE aggregate for {context.code}")

            restaurants_count = int(row[2])
            bars_cafes_count = int(row[3])
            nightlife_extension_count = int(row[4])

            arrondissements.append(
                {
                    "code": context.code,
                    "number": context.number,
                    "name": context.name,
                    "area_km2": context.area_km2,
                    "active_establishments_total": int(row[1]),
                    "restaurants_count": restaurants_count,
                    "bars_cafes_count": bars_cafes_count,
                    "nightlife_extension_count": nightlife_extension_count,
                    "restaurants_per_km2": round2(
                        restaurants_count / context.area_km2
                    ),
                    "bars_per_km2": round2(bars_cafes_count / context.area_km2),
                    "cafes_per_km2": round2(bars_cafes_count / context.area_km2),
                }
            )

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": {
                "type": "sirene_stock_parquet",
                "source_url": "https://object.files.data.gouv.fr/data-pipeline-open/siren/stock/StockEtablissement_utf8.parquet",
                "stock_path": stock_path.as_posix(),
                "stock_size_bytes": stock_path.stat().st_size,
                "nomenclature": "NAFRev2",
            },
            "buckets": {
                "restaurants": RESTAURANT_CODES,
                "bars_cafes": BARS_CAFES_CODES,
                "nightlife_extension": NIGHTLIFE_EXTENSION_CODES,
            },
            "stats": {
                "commune_count": len(arrondissements),
                "active_establishments_total": int(summary_row[0]),
                "restaurants_count_total": int(summary_row[1]),
                "bars_cafes_count_total": int(summary_row[2]),
                "nightlife_extension_count_total": int(summary_row[3]),
            },
            "notes": [
                "Counts include only active SIRENE establishments in Paris arrondissements with nomenclatureActivitePrincipaleEtablissement = NAFRev2.",
                "cafes_per_km2 mirrors bars_per_km2 because SIRENE groups cafes with debits de boissons under NAF 56.30Z.",
                "nightlife_extension_count is provided for reference but is not part of the default nightlife score.",
            ],
            "arrondissements": arrondissements,
        }
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    stock_path = Path(args.stock)
    areas_path = Path(args.areas)
    out_path = Path(args.out)

    if not stock_path.exists():
        raise SystemExit(f"missing stock parquet: {stock_path}")
    if not areas_path.exists():
        raise SystemExit(f"missing area source: {areas_path}")

    arrondissement_contexts = load_arrondissement_contexts(areas_path)
    snapshot = build_snapshot(stock_path, arrondissement_contexts)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=True) + "\n")
    print(out_path.as_posix())


if __name__ == "__main__":
    main()
