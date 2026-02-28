# Quartier: Paris Arrondissement Comparator -- v1 Spec

quartier.sh

## Overview

Interactive tool for comparing Paris's 20 arrondissements across 8+ data dimensions (housing prices, income, safety, transport, nightlife, green space, noise, amenities). Map-first, mobile-first, bilingual (FR/EN).

**Target users:** Parisians exploring their city, people moving to/within Paris, tourists choosing where to stay, business owners scouting locations.

**Aesthetic:** Warm editorial (The Pudding, Bloomberg CityLab). Personality, custom typography, storytelling feel. Not a generic dashboard. Applied as a final polish pass; shadcn/ui defaults used throughout development.

## Architecture

**Single Next.js app. No monorepo, no separate backend.**

All data is pre-computed at build time by a TypeScript script and shipped as static JSON. The only server-side route is OG image generation. All scoring, filtering, and persona switching happens client-side. There is no runtime computation heavy enough to justify a compiled language or separate service.

**Data refresh model (v1):** Ingestion is snapshot-based and manually triggered. We do not fetch third-party datasets at app runtime and we do not auto-refresh on deploy. Generated artifacts (`data/arrondissements.json`, `data/arrondissements.geojson`, `data/metadata.json`) are committed and can stay unchanged for weeks/months until a deliberate refresh run.

**Sequential dimension rollout is allowed:** v1 does not require all 8 dimensions on day one. Dimensions can be enabled one-by-one in the ingestion config; non-enabled dimensions are emitted as `null` and shown as `N/A` in UI.

**Why not Rust/Go:** The heaviest runtime operation is `sum(weight[i] * score[i])` for 20 arrondissements across 8 dimensions (160 multiplications). The build script processes ~50MB of CSVs, which TypeScript handles in seconds. A compiled backend adds toolchain complexity for zero measurable gain.

**Why not a monorepo:** One app, one build script. No shared packages, no mobile app, no separate services. Turborepo/nx config overhead for nothing. Revisit if a separate backend is ever needed.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS 4 + shadcn/ui (radix-nova)
- **Map:** MapLibre GL JS + react-map-gl, MapTiler free tier for base tiles
- **Spatial:** @turf/turf (point-in-polygon, area computation, polygon intersection in build script)
- **Charts:** Recharts (phase 6 only)
- **URL state:** nuqs (type-safe search params for `?arr=N` selection syncing)
- **i18n:** next-intl (French + English)
- **Data:** Pre-computed static JSON, bundled in repo
- **GeoJSON:** Paris arrondissement boundaries bundled in repo (from opendata.paris.fr)
- **Hosting:** Vercel
- **OG images:** @vercel/og for dynamic social sharing images
- **Env vars:** `NEXT_PUBLIC_MAPTILER_KEY` (public, not secret, but configurable)

## Data Dimensions (v1)

All data is pre-computed per arrondissement and shipped as static JSON.

| #   | Dimension             | Source                                  | Format                   | Metric                                                   | Processing notes                                                                                                                                                                                                                                                                                  |
| --- | --------------------- | --------------------------------------- | ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Housing affordability | DVF (data.gouv.fr)                      | CSV.gz by departement    | Median price/m2 (apartments), YoY trend                  | Parse departement 75 yearly snapshots and filter `code_commune` 75101..75120. Filter `type_local = "Appartement"`. Multi-row mutations: group by `id_mutation`, use `valeur_fonciere / surface_reelle_bati`. Drop rows with missing surface. Trim outliers (below 1st and above 99th percentile). |
| 2   | Income                | INSEE dossier complet (Filosofi fields) | CSV inside ZIP           | Median household income, poverty rate                    | Parse `dossier_complet.csv` from the yearly INSEE archive and map `CODGEO` to communes `75101..75120`. Use `MED21` (median income) and `TP6021` (poverty rate). Same table provides shared population (`NBPERSMENFISC21`).                                                                        |
| 3   | Safety                | SSMSI crime stats                       | CSV                      | Total crime rate per 1k residents, breakdown by category | Population data needed from separate INSEE source to compute per-capita rates.                                                                                                                                                                                                                    |
| 4   | Transport density     | IDFM station data                       | GeoJSON/CSV with lat/lon | Metro/RER stations per km2                               | **Spatial: point-in-polygon** test each station against arrondissement boundaries using turf.js.                                                                                                                                                                                                  |
| 5   | Nightlife & dining    | SIRENE (API)                            | JSON via API             | Restaurants per km2, bars+cafes per km2                  | **Cannot download full SIRENE (5GB+).** Use INSEE API SIRENE: query by commune code (75101-75120) + validated NAF Rev.2 codes. Free token required, 30 req/min rate limit. ~20 paginated queries.                                                                                                 |
| 6   | Green space           | opendata.paris.fr                       | GeoJSON polygons         | m2 of green space per resident                           | **Spatial: polygon intersection.** Parks can span arrondissements. Clip with turf.js `intersect()`, compute area with `turf.area()`.                                                                                                                                                              |
| 7   | Noise                 | Bruitparif / data.gouv.fr               | CSV                      | % residents exposed above Lden thresholds                | Straightforward. Already per arrondissement.                                                                                                                                                                                                                                                      |
| 8   | Amenities             | BPE (INSEE)                             | CSV                      | Pharmacies, doctors, schools, gyms, cinemas per km2      | Filter by commune codes 75101-75120. Count equipment by type code.                                                                                                                                                                                                                                |

**Score direction:** All dimensions are scored so that higher = better for the resident. Housing uses affordability (cheap = high score). Safety uses inverse crime rate (low crime = high score). Noise uses inverse exposure (low noise = high score). Persona weights control importance, not direction.

### v1 Dimension Rollout Order

Dimensions are implemented and shipped sequentially, not all-at-once.

1. Housing (DVF), Income (Filosofi), Safety (SSMSI), Transport (IDFM)
2. Noise (Bruitparif), Amenities (BPE)
3. Green space (polygon intersection)
4. Nightlife (SIRENE API; highest operational risk)

At any intermediate milestone, missing dimensions are represented as `null` in data and excluded from composite scoring.

**Stretch dimensions (future):**

| #   | Dimension       | Source                | Metric                                                              | Notes                                                                                                                      |
| --- | --------------- | --------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 9   | Air quality     | Airparif station data | Avg NO2/PM2.5                                                       | Only ~15-20 stations in Paris. Would need spatial interpolation (IDW or nearest-neighbor) per arrondissement. Non-trivial. |
| 10  | Velib density   | Velib GBFS            | Stations per km2, avg bike availability                             | Real-time GBFS API, no auth. Snapshot at build time. Point-in-polygon for station counts.                                  |
| 11  | Political color | Election results      | Raw vote % per party from latest presidential + municipal elections | Commune-level election data on data.gouv.fr. Paris arrondissements have their own results.                                 |
| 12  | Walkability     | Derived               | Composite of transport + amenity + green space density              | Meta-dimension computed from other scores. No new data source needed.                                                      |

## Data Pipeline

**Primary build-time script** (`scripts/build-data.ts`), run manually (primary) or in CI (optional). Output is committed to the repo.
**Supplemental refresh script** (`scripts/data-refresh.ts`) is used for SIRENE snapshot pulls and cache refreshes.

### Operating model (v1)

- Manual snapshot refresh only (no scheduled refresh)
- Raw source artifacts cached under `data/raw/` and reused across runs
- Third-party fetches happen only when running data scripts (`data:build`, `data:refresh`)
- App build/deploy reads committed artifacts only
- CI should default to `--offline` validation against committed artifacts

### Reproducibility contract

- Every source is pinned by explicit vintage/version in `scripts/data-config.ts` (year, dataset resource id, or download URL)
- Prefer explicit vintage URLs; when upstream only exposes `latest` paths, pin year in config and rely on checksums in `metadata.json` to detect drift
- `data/metadata.json` records `generated_at`, source vintages, fetch URLs, row counts, and checksums

### Step-by-step pipeline

```
1. Load ingestion config (`scripts/data-config.ts`)
   - Enabled dimensions (subset allowed)
   - Source vintages/URLs (pinned)
2. Load bundled arrondissement boundaries (source-controlled file)
   - Validate exactly 20 arrondissements: commune codes 75101..75120
   - Compute `area_km2` from boundary `surface` (m2) in the pinned GeoJSON snapshot
3. Build shared base tables
   - Population per arrondissement from INSEE dossier complet (`NBPERSMENFISC21`)
4. For each enabled dimension, fetch from cache-or-network and compute metrics
   a. DVF (implemented in `build-data.ts`):
      - Parse departement 75 CSV snapshots for target year + prior year, then filter arrondissement communes 75101..75120
      - Filter apartments, group by `id_mutation`, compute price/m2
      - Trim outliers using fixed percentile rule
   b. Filosofi (implemented in `build-data.ts`):
      - Parse INSEE dossier complet CSV-in-ZIP, filter `CODGEO` = `75101..75120`
      - Extract `MED21` (median income) + `TP6021` (poverty rate)
   c. SSMSI (implemented in `build-data.ts`, disabled unless `safety` is enabled):
      - Parse crime CSV, filter 75101..75120, compute per-1k with population
   d. IDFM (implemented in `build-data.ts`, disabled unless `transport` is enabled):
      - Point-in-polygon station assignment, compute `station_count` + `stations_per_km2`
   e. SIRENE (implemented in `build-data.ts` + `data-refresh.ts`, enabled when `nightlife` is in `enabledDimensions`):
      - Query API by arrondissement + NAF bucket
      - Use `codeCommuneEtablissement` (not `communeEtablissement`)
      - Filter active establishments with `periode(etatAdministratifEtablissement:A ...)`
      - Paginate with retry/backoff/rate-limit guard
      - Cache raw responses before aggregation
      - Compute nightlife densities from buckets (restaurants and bars+cafes)
      - `cafes_per_km2` currently mirrors `bars_per_km2` because SIRENE v1 groups both under NAF `56.30Z`
   f. Green space (implemented in `build-data.ts`, enabled when `greenSpace` is in `enabledDimensions`):
      - Intersect park polygons with arrondissement polygons
      - Sum clipped area and compute m2/resident
   g. Noise (implemented in `build-data.ts`, enabled when `noise` is in `enabledDimensions`):
      - Parse Ville de Paris road-noise exposure fields and compute `% residents above thresholds`
      - Source reports `Paris Centre` (1er-4e) as one aggregate; parser maps that rate to 75101..75104
   h. BPE (implemented in `build-data.ts`, enabled when `amenities` is in `enabledDimensions`):
      - Query aggregated BPE records by arrondissement (`com_arm_code`) and equipment code
      - Aggregate counts for pharmacies, doctors, schools, gyms, and cinemas
5. Run data-quality gates (fail/warn policy)
6. Normalize enabled dimensions to 0-100 and invert where needed
7. Emit:
   - `data/arrondissements.json`
   - `data/arrondissements.geojson` (boundaries + selected score props)
   - `data/metadata.json` (provenance + quality report)
```

### Current implementation snapshot (as of 2026-02-28)

- `DATA_CONFIG.enabledDimensions`: `housing`, `income`, `safety`, `transport`, `greenSpace`, `noise`, `amenities`
- `scripts/build-data.ts` currently emits production artifacts for:
  - base fields (code/number/name/population/area)
  - housing (DVF)
  - income (Filosofi)
  - safety (SSMSI parser enabled)
  - transport (IDFM parser enabled)
  - nightlife (SIRENE parser integrated; populated only when `nightlife` is enabled in config)
  - greenSpace (polygon intersection parser integrated; populated only when `greenSpace` is enabled in config)
  - noise (Ville de Paris road-noise parser enabled)
  - amenities (BPE parser enabled)
  - normalized scores for enabled dimensions
- `scripts/data-refresh.ts` pre-warms/rebuilds cached SIRENE nightlife snapshots used by the build path
- Current coverage in `data/metadata.json`: housing `20/20`, income `20/20`, safety `20/20`, transport `20/20`, greenSpace `20/20`, noise `20/20`, amenities `20/20`, nightlife `0/20` (nightlife remains disabled in `enabledDimensions`)
- Latest stability validation (2026-02-28):
  - `bun run data:build`: completed in ~16.7s with 2 warnings (`SSMSI nombre` + 2 non-polygon green-space features skipped)
  - `bun run data:build --offline`: completed in ~16.3s with the same 2 warnings

### Manual refresh commands

- `bun run data:build` -- build `arrondissements.json`, enrich `arrondissements.geojson`, write `metadata.json`
- `bun run data:build --offline` -- same build, but fail if cached INSEE dossier-complet archive or enabled-dimension raw snapshots are missing
- `bun run data:refresh --dimensions=nightlife --all` -- refresh SIRENE nightlife raw snapshots for all arrondissements
- `bun run data:refresh --dimensions=nightlife --offline --all` -- rebuild nightlife raw snapshots from cache only
- Offline guard: if `nightlife` is enabled, `data:build --offline` hard-fails when `data/raw/sirene/` has no cached pages

### Dependencies for build script

- Current implementation (through Phase 1D SIRENE + green-space build integration) uses built-in `fetch` + Node fs/path/crypto/zlib + child-process streaming (`unzip`) for large CSV-in-ZIP extraction
- `@turf/turf` is now used in data parsers for polygon intersection + area computation

### Population and area sources

- **Population (current):** INSEE dossier complet shared table (`NBPERSMENFISC21`) from the pinned archive in `scripts/data-config.ts`.
- **Area:** `surface` field from the pinned arrondissement GeoJSON snapshot (m2), converted to `area_km2`.

### Data quality gates

Hard-fail gates (build fails):

- Exactly 20 arrondissement records exist (`75101`..`75120`)
- No duplicate arrondissement codes
- Required base fields present for all rows (`code`, `number`, `name`, `population`, `area_km2`)
- No negative values for counts, rates, or area
- For enabled dimensions: at least 18/20 arrondissements populated

Soft-fail gates (warning in metadata + console):

- Implemented now:
  - A dimension has 1-2 missing arrondissements (explicit `null`)
  - Source row count deviates materially from prior snapshot (current threshold: 15% absolute delta)
  - Strong metric drift vs prior snapshot on enabled dimensions (current threshold: 20% absolute delta on median raw value)

### Missing data behavior

- A non-enabled dimension is emitted as `null` for all arrondissements
- An enabled-but-missing arrondissement value is emitted as `null`
- UI renders `N/A` for `null` fields
- Composite score excludes `null` dimensions and re-normalizes active persona weights over available dimensions

### SIRENE query strategy

**Chosen approach: INSEE API SIRENE** (https://api.insee.fr/entreprises/sirene/V3.11)

- Free token required (register at api.insee.fr)
- Rate limit: 30 requests/minute (sufficient for ~20 paginated queries)
- Query pattern: filter by `codeCommuneEtablissement` + `activitePrincipaleEtablissement` (NAF Rev.2 code)
- Token stored in `SIRENE_API_TOKEN` env var (used only in data scripts, never at runtime)
- Use retry with exponential backoff for `429`/`5xx`
- Cache every raw response page to `data/raw/sirene/` to avoid re-pulling unchanged pages

**Canonical query template (v1):**

`q=periode(etatAdministratifEtablissement:A AND (<APE_FILTER>)) AND codeCommuneEtablissement:751XX`

Use `OR` inside `<APE_FILTER>` for multi-code buckets.

**Validated NAF Rev.2 bucket mapping (v1, non-overlapping):**

- Restaurants: `56.10A` (Restauration traditionnelle), `56.10B` (Cafeterias/libre-service), `56.10C` (Restauration rapide)
- Bars + cafes: `56.30Z` (includes cafes and drinking places)
- Optional nightlife extension (off by default): `93.29Z` for leisure/club-like activities not classed as beverage-serving establishments

`56.10D` and `56.10E` are not valid NAF Rev.2 sub-classes and must not be used.

Counts and per-km2 metrics are computed per bucket and as a total nightlife density.

### NAF transition guard

- Persist `nomenclatureActivitePrincipaleEtablissement` in raw snapshots/metadata
- Hard-fail if returned nomenclature is not expected for the configured mapping
- Add a dedicated migration task before NAF 2025 becomes mandatory in SIRENE queries

**Tradeoff vs alternatives:**

- data.gouv.fr Tabular API: simpler auth but 200-row page limit, slower for filtered queries
- Full SIRENE download: 5GB+, overkill for counting restaurants in 20 arrondissements
- Pre-filtered Paris extract: none exists on data.gouv.fr as of writing

## Data Schema

```typescript
type DimensionKey =
  | "housing"
  | "income"
  | "safety"
  | "transport"
  | "nightlife"
  | "greenSpace"
  | "noise"
  | "amenities";

type Arrondissement = {
  code: string; // "75109"
  number: number; // 9
  name: string; // "9e arrondissement"
  population: number;
  area_km2: number;
  dimensions: {
    housing: {
      median_price_m2: number;
      yoy_change: number; // percentage
      transaction_count: number;
    } | null;
    income: {
      median_household: number;
      poverty_rate: number;
    } | null;
    safety: {
      crime_rate_per_1k: number;
      categories: Record<string, number>;
    } | null;
    transport: {
      stations_per_km2: number;
      metro_lines: string[];
    } | null;
    nightlife: {
      restaurants_per_km2: number;
      bars_per_km2: number;
      cafes_per_km2: number;
    } | null;
    greenSpace: {
      total_area_m2: number;
      m2_per_resident: number;
      park_count: number;
    } | null;
    noise: {
      pct_above_lden_threshold: number;
      pct_above_night_threshold: number;
    } | null;
    amenities: {
      pharmacies: number;
      doctors: number;
      schools: number;
      gyms: number;
      cinemas: number;
    } | null;
  };
  scores: Record<DimensionKey, number | null>; // 0-100 per enabled dimension
};

type DataMetadata = {
  generated_at: string; // ISO timestamp
  enabled_dimensions: DimensionKey[];
  source_vintages: Record<string, string>; // e.g. "dvf":"2024", "filosofi":"2021"
  source_urls: Record<string, string>;
  source_row_counts: Record<string, number>;
  source_checksums: Record<string, string>;
  quality: {
    hard_fail_checks_passed: boolean;
    hard_fail_errors: string[];
    warnings: string[];
    coverage_by_dimension: Record<DimensionKey, number>; // populated arrondissements count
  };
};
```

**Composite score is NOT stored in the JSON.** It depends on persona weights which change client-side. The JSON stores only normalized 0-100 scores per enabled dimension. The client computes `composite = sum(weight[i] * score[i]) / sum(weights)` over non-null dimensions only (weights re-normalized after dropping nulls). For OG images, a default composite is computed server-side using equal weights over available dimensions.

## Pages & Routes

### `/{locale}` -- Home / Map View

- Full-screen interactive map of Paris (MapLibre)
- IDF context layer (surrounding departments as subtle outlines on white background) for geographic context
- Arrondissements rendered as colored choropleth polygons
- Color intensity = currently selected dimension's score (or composite score)
- Dimension selector dropdown in toolbar to change what the map shows
- Persona selector dropdown: "Young professional", "Family", "Tourist", "Business owner"
  - Each preset adjusts dimension weights for composite score
- Click arrondissement: wider drawer slides in (desktop: 384-448px) / taller bottom sheet slides up (mobile: 85vh)
  - URL updates to `?arr=N` via nuqs (`useQueryState` with `history: 'push'`)
  - Shows composite score bar + all 8 dimension cards with scores and raw values (reuses `DimensionSection` component)
  - "View full details" link at bottom navigates to `/paris/{number}` detail page
  - Escape key or close button dismisses the drawer and removes `?arr` from URL
  - Direct visit to `/?arr=9` hydrates from URL and opens drawer immediately
  - Browser back/forward navigates between selections
  - Invalid `?arr` values (out of 1-20 range) are ignored gracefully
  - Dynamic OG metadata: visiting `/?arr=9` sets OG title/image to that arrondissement
- Hover arrondissement: tooltip with name + current score (rendered via DOM refs to avoid React re-renders/flicker)

### `/{locale}/leaderboard` -- Ranking Table

- Full leaderboard of all 20 arrondissements
- Single scrollable dashboard: all dimensions visible as columns
- Sortable by any column (click header)
- Default sort: composite score (descending)
- Persona selector in toolbar (same as map view, shared state)
- Missing data shown with "N/A" badge
- Each row links to detail page
- Mobile: horizontal scroll for columns, sticky first column (arrondissement name)

### `/{locale}/paris/{number}` -- Arrondissement Detail

- Shareable URL per arrondissement (e.g., `/en/paris/9`)
- Small map showing the arrondissement highlighted
- All dimensions displayed as sections with:
  - Score (0-100) with visual bar/indicator
  - Raw values
  - Recharts mini-charts where relevant (phase 6: DVF price trend, crime evolution)
- Composite score with breakdown of how each dimension contributes
- Dynamic OG image via @vercel/og

### `/{locale}/compare` -- Side-by-Side (future)

- Pick 2-4 arrondissements from a multiselect
- Bar charts per dimension comparing selected arrondissements

## Persona Presets

Each persona defines default weights (0-100) per dimension. Weights are normalized to sum to 100.

| Dimension             | Young Pro | Family | Tourist | Business |
| --------------------- | --------- | ------ | ------- | -------- |
| Housing affordability | 25        | 30     | 5       | 15       |
| Income                | 10        | 15     | 0       | 20       |
| Safety                | 15        | 25     | 20      | 15       |
| Transport             | 20        | 10     | 25      | 10       |
| Nightlife & dining    | 20        | 5      | 30      | 15       |
| Green space           | 5         | 10     | 10      | 5        |
| Noise                 | 5         | 15     | 5       | 5        |
| Amenities             | 0         | 20     | 5       | 15       |

Weight sliders for user customization are a future addition. v1 ships with preset-only selection via dropdown.

## i18n Strategy

- **next-intl** with `/{locale}/...` route prefix
- Default locale: `fr`
- Supported: `fr`, `en`
- UI strings (navigation, labels, descriptions, dimension names): translated
- Data values (street names, crime category names, business types): always French, not translated
- Locale persisted in URL path

## Mobile-First Layout

**Map view (mobile):**

- Map fills viewport
- Floating toolbar at top: dimension selector + persona dropdown
- Tap arrondissement: bottom sheet slides up (85vh) with drag handle, all dimension cards, URL syncs to `?arr=N`

**Map view (desktop):**

- Map fills left ~65% of viewport
- Click arrondissement: wider right panel (384-448px) slides in with full dimension cards
- Toolbar at top of map area

**Leaderboard (mobile):**

- Vertical card list (one card per arrondissement) instead of wide table
- Or: horizontal-scrollable table with sticky first column
- Dimension filter to show/hide columns

**Detail page (both):**

- Vertical scroll, section per dimension
- Mini-map at top (not interactive, just shows location)

## Social Sharing / OG Images

- Each `/paris/{number}` page generates a dynamic OG image at `app/api/og/[number]/route.tsx`
- Default OG image for home/leaderboard at `app/api/og/route.tsx`
- Uses `next/og` (ImageResponse API) with Geist font loaded from `assets/fonts/`
- Per-arrondissement image shows: arrondissement number (large), composite score (equal weights), rank, top 3 dimension scores
- Default image shows: "Quartier" brand, tagline, all 8 dimension names as tags
- Design: light background (#fafafa), clean minimalist typography, Geist sans-serif
- All OG routes are **outside** the `[locale]` prefix (images are language-independent)
- Twitter Card (`summary_large_image`) + Open Graph meta tags set per page via `generateMetadata`
- Layout-level metadata provides default OG/Twitter tags; detail pages override with arrondissement-specific images

## Scoring Algorithm

1. For each enabled dimension, compute a raw value per arrondissement (build script)
2. Apply outlier handling before scaling
   - Unbounded metrics: winsorize at 1st/99th percentile
   - Bounded percentage metrics (0-100): no winsorization
3. Normalize to 0-100 using min-max scaling over populated arrondissements only
   - Invert for "lower is better" dimensions: housing price, crime rate, noise exposure
   - Higher score = better for the resident, always
   - If all populated values are identical, assign score `50` for that dimension
4. Store normalized scores in JSON (`null` for non-enabled or missing values)
5. Composite score computed **client-side** on non-null dimensions only: `sum(weight[i] * score[i]) / sum(weights)`
6. Weights come from active persona preset and are re-normalized after dropping null dimensions
7. For OG images: compute composite server-side using equal weights over available dimensions

## File Structure

```
app/
  [locale]/
    layout.tsx              # i18n provider, nav, fonts
    page.tsx                # map view (home)
    leaderboard/
      page.tsx              # ranking table
    paris/
      [number]/
        page.tsx            # arrondissement detail
  api/
    og/
      [number]/
        route.tsx           # dynamic OG image generation (outside [locale])
components/
  map/
    paris-map.tsx           # MapLibre + arrondissement polygons + inline tooltip
    map-panel.tsx           # side panel / bottom sheet on click
  leaderboard/
    leaderboard-table.tsx   # sortable table
    leaderboard-card.tsx    # mobile card variant
  detail/
    dimension-section.tsx   # single dimension display
    score-bar.tsx           # visual 0-100 bar
    mini-chart.tsx          # Recharts wrapper (phase 6)
  scoring/
    persona-selector.tsx    # dropdown with presets
    weight-sliders.tsx      # adjustable dimension weights (future)
  layout/
    nav.tsx                 # top navigation
    locale-switcher.tsx     # FR/EN toggle
lib/
  data.ts                   # load and type the static JSON
  scoring.ts                # weight + composite computation (client-side)
  search-params.ts          # nuqs parser + cache for ?arr=N URL state
  i18n.ts                   # next-intl config
  arrondissements.ts        # metadata (names, numbers, colors)
data/
  arrondissements.json      # pre-computed dimension data (committed)
  arrondissements.geojson   # boundary polygons (committed)
  metadata.json             # provenance + quality checks (committed)
  raw/                      # cached source payloads/snapshots (gitignored)
scripts/
  data-config.ts            # pinned source vintages + enabled dimensions
  build-data.ts             # orchestrator: download, parse, aggregate, output JSON
  data-refresh.ts           # refresh utility for SIRENE nightlife snapshots
  dry-run-sirene-queries.ts # inspect generated SIRENE query URLs
  validate-sirene-naf.ts    # validate configured NAF bucket mapping
  sources/
    dvf.ts                  # DVF CSV parsing + median computation
    filosofi.ts             # INSEE dossier-complet CSV-in-ZIP parsing for income + shared population
    crime.ts                # SSMSI communal crime parsing for safety metrics
    transport.ts            # IDFM station parsing + arrondissement assignment
    noise.ts                # Ville de Paris road-noise exposure parsing
    amenities.ts            # BPE arrondissement amenities aggregation
    green-space.ts          # Paris green-space polygon intersection by arrondissement
    sirene.ts               # INSEE API SIRENE queries for nightlife/dining
    sirene-query.ts         # canonical SIRENE search query builder
    sirene-naf.ts           # NAF bucket definitions for nightlife
    validate-sirene-naf.ts  # NAF mapping validation
messages/
  fr.json                   # French UI strings
  en.json                   # English UI strings
```

## Environment Variables

| Variable                   | Where used                | Secret?     | Notes                                                                                                           |
| -------------------------- | ------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MAPTILER_KEY` | Client-side map rendering | No (public) | MapTiler free tier API key. Exposed in browser JS.                                                              |
| `SIRENE_API_TOKEN`         | Data scripts only         | Yes         | Required only for online nightlife refresh/build ingestion. Never exposed at runtime. Register at api.insee.fr. |

## Design Approach

Use shadcn/ui defaults (radix-nova preset) throughout. No custom styling until all functionality works. The warm editorial aesthetic (typography, color palette, spacing, personality) is a final polish pass, not a building concern.

## Phasing

### Phase 1A: Ingestion Contract + Infrastructure

1. [x] Lock schema contract (`null` handling, units, dimension keys, score keys)
2. [x] Add `scripts/data-config.ts` for enabled dimensions + pinned vintages
3. [x] Implement cache-or-network fetch layer with timeout/retry/rate-limit controls
4. [x] Add provenance output (`data/metadata.json`)
5. [x] Add hard-fail quality gates
6. [x] Add soft-fail drift gates (row-count/metric drift vs prior snapshot)

### Phase 1B: Core Dimensions (ship first snapshot)

1. [x] DVF housing parser
2. [x] Filosofi income parser (+ shared population table)
3. [x] SSMSI safety parser
4. [x] IDFM transport parser
5. [x] Normalization + score output for enabled dimensions only
6. [x] Commit first production snapshot

### Phase 1C: Medium-risk Dimensions

1. [x] Noise parser
2. [x] BPE amenities parser
3. [x] Validate drift/coverage against prior snapshot
4. Commit refreshed snapshot

### Phase 1D: High-risk Dimensions

1. [x] Green space polygon intersection module
2. [x] SIRENE nightlife API module (with cache and retry policy) -- integrated in refresh + build paths
3. Validate runtime cost and data stability (greenSpace validated; nightlife runtime validation pending `SIRENE_API_TOKEN` or cached SIRENE pages)
4. Commit refreshed snapshot

### Phase 2: Core Functionality

1. Map view with choropleth, dimension selector, click-to-panel
2. Leaderboard with sortable columns
3. Detail pages with scores + raw values
4. Persona dropdown with 4 presets (fixed weights)
5. Composite scoring engine over available dimensions

### Phase 3: i18n + Routing

1. next-intl setup with `/{locale}/...` routes
2. FR/EN UI strings for labels and dimension names
3. Locale switcher component

### Phase 4: Mobile + Responsive

1. Mobile-first map + bottom sheet
2. Desktop map + side panel
3. Responsive leaderboard/detail layouts

### Phase 5: Social + Deploy

1. [x] Dynamic OG image generation per arrondissement (next/og + Geist font)
2. [x] Meta tags per page (OG + Twitter Card via generateMetadata)
3. [x] Deploy to Vercel at quartier.sh

### Phase 6: UI Polish

1. Recharts mini-charts on detail pages
2. Map styling refinements
3. Loading/empty/error states

### Future

1. Weight sliders (adjustable beyond persona presets)
2. Stretch dimensions (air quality, Velib, political data, walkability)
3. Compare view (side-by-side 2-4 arrondissements)
4. Expand to all French communes (same architecture, more data)
5. IRIS-level drill-down within arrondissements
6. Time-series animations (how scores changed over years)

## Data Sources

- DVF: https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/
- DVF geo-split CSVs: https://files.data.gouv.fr/geo-dvf/latest/csv/
- Filosofi income (catalog): https://www.data.gouv.fr/fr/datasets/revenus-et-pauvrete-des-menages-aux-niveaux-national-et-local-revenus-localises-sociaux-et-fiscaux/
- INSEE dossier complet archive (current parser source): https://www.insee.fr/fr/statistiques/5359146
- Crime (SSMSI): https://www.data.gouv.fr/fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/
- IDFM stations: https://data.iledefrance-mobilites.fr/explore/dataset/emplacement-des-gares-idf/
- SIRENE: https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/
- SIRENE API: https://api.insee.fr/entreprises/sirene/V3.11
- BPE amenities: https://www.data.gouv.fr/fr/datasets/base-permanente-des-equipements-1/
- BPE parser source (current implementation): https://public.opendatasoft.com/explore/dataset/buildingref-france-bpe-all-millesime/
- Green spaces: https://opendata.paris.fr/explore/dataset/espaces_verts/
- Noise: https://www.data.gouv.fr/fr/datasets/bruit-routier-exposition-des-parisien-ne-s-aux-depassements-des-seuils-nocturne-ou-journee-complete/
- Arrondissement boundaries: https://opendata.paris.fr/explore/dataset/arrondissements/
- Airparif: https://data-airparif-asso.opendata.arcgis.com/
- Velib: https://www.velib-metropole.fr/donnees-open-data-gbfs-du-service-velib-metropole
- Election results: https://www.data.gouv.fr/fr/datasets/elections-presidentielles-1965-2022-2eme-tour/
- INSEE API SIRENE registration: https://api.insee.fr/catalogue/
