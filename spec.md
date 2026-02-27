# Quartier: Paris Arrondissement Comparator -- v1 Spec

quartier.sh

## Overview

Interactive tool for comparing Paris's 20 arrondissements across 8+ data dimensions (housing prices, income, safety, transport, nightlife, green space, noise, amenities). Map-first, mobile-first, bilingual (FR/EN).

**Target users:** Parisians exploring their city, people moving to/within Paris, tourists choosing where to stay, business owners scouting locations.

**Aesthetic:** Warm editorial (The Pudding, Bloomberg CityLab). Personality, custom typography, storytelling feel. Not a generic dashboard. Applied as a final polish pass; shadcn/ui defaults used throughout development.

## Architecture

**Single Next.js app. No monorepo, no separate backend.**

All data is pre-computed at build time by a TypeScript script and shipped as static JSON. The only server-side route is OG image generation. All scoring, filtering, and persona switching happens client-side. There is no runtime computation heavy enough to justify a compiled language or separate service.

**Why not Rust/Go:** The heaviest runtime operation is `sum(weight[i] * score[i])` for 20 arrondissements across 8 dimensions (160 multiplications). The build script processes ~50MB of CSVs, which TypeScript handles in seconds. A compiled backend adds toolchain complexity for zero measurable gain.

**Why not a monorepo:** One app, one build script. No shared packages, no mobile app, no separate services. Turborepo/nx config overhead for nothing. Revisit if a separate backend is ever needed.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS 4 + shadcn/ui (radix-nova)
- **Map:** MapLibre GL JS + react-map-gl, MapTiler free tier for base tiles
- **Spatial:** @turf/turf (point-in-polygon, area computation, polygon intersection in build script)
- **Charts:** Recharts (phase 6 only)
- **i18n:** next-intl (French + English)
- **Data:** Pre-computed static JSON, bundled in repo
- **GeoJSON:** Paris arrondissement boundaries bundled in repo (from opendata.paris.fr)
- **Hosting:** Vercel
- **OG images:** @vercel/og for dynamic social sharing images
- **Env vars:** `NEXT_PUBLIC_MAPTILER_KEY` (public, not secret, but configurable)

## Data Dimensions (v1)

All data is pre-computed per arrondissement and shipped as static JSON.

| # | Dimension | Source | Format | Metric | Processing notes |
|---|---|---|---|---|---|
| 1 | Housing affordability | DVF (data.gouv.fr) | CSV, pre-split per arrondissement | Median price/m2 (apartments), YoY trend | Filter `type_local = "Appartement"`. Multi-row mutations: group by `id_mutation`, use `valeur_fonciere / surface_reelle_bati`. Drop rows with missing surface. Trim outliers (below 1st and above 99th percentile). |
| 2 | Income | Filosofi / INSEE | **XLSX** | Median household income, poverty rate | Needs XLSX parser (`xlsx` or `exceljs`). Wide format with coded column names. Map codes to fields. |
| 3 | Safety | SSMSI crime stats | CSV | Total crime rate per 1k residents, breakdown by category | Population data needed from separate INSEE source to compute per-capita rates. |
| 4 | Transport density | IDFM station data | GeoJSON/CSV with lat/lon | Metro/RER stations per km2 | **Spatial: point-in-polygon** test each station against arrondissement boundaries using turf.js. |
| 5 | Nightlife & dining | SIRENE (API) | JSON via API | Restaurants, bars, cafes per km2 (NAF codes 56.10A, 56.30Z, etc.) | **Cannot download full SIRENE (5GB+).** Use INSEE API SIRENE: query by commune code (75101-75120) + NAF codes. Free token required, 30 req/min rate limit. ~20 paginated queries. |
| 6 | Green space | opendata.paris.fr | GeoJSON polygons | m2 of green space per resident | **Spatial: polygon intersection.** Parks can span arrondissements. Clip with turf.js `intersect()`, compute area with `turf.area()`. |
| 7 | Noise | Bruitparif / data.gouv.fr | CSV | % residents exposed above Lden thresholds | Straightforward. Already per arrondissement. |
| 8 | Amenities | BPE (INSEE) | CSV | Pharmacies, doctors, schools, gyms, cinemas per km2 | Filter by commune codes 75101-75120. Count equipment by type code. |

**Score direction:** All dimensions are scored so that higher = better for the resident. Housing uses affordability (cheap = high score). Safety uses inverse crime rate (low crime = high score). Noise uses inverse exposure (low noise = high score). Persona weights control importance, not direction.

**Stretch dimensions (future):**

| # | Dimension | Source | Metric | Notes |
|---|---|---|---|---|
| 9 | Air quality | Airparif station data | Avg NO2/PM2.5 | Only ~15-20 stations in Paris. Would need spatial interpolation (IDW or nearest-neighbor) per arrondissement. Non-trivial. |
| 10 | Velib density | Velib GBFS | Stations per km2, avg bike availability | Real-time GBFS API, no auth. Snapshot at build time. Point-in-polygon for station counts. |
| 11 | Political color | Election results | Raw vote % per party from latest presidential + municipal elections | Commune-level election data on data.gouv.fr. Paris arrondissements have their own results. |
| 12 | Walkability | Derived | Composite of transport + amenity + green space density | Meta-dimension computed from other scores. No new data source needed. |

## Data Pipeline

**Build-time script** (`scripts/build-data.ts`), run manually or in CI. Output is committed to the repo.

### Step-by-step pipeline

```
1. Download arrondissement GeoJSON boundaries (one-time, bundled)
2. Compute area_km2 per arrondissement from GeoJSON using turf.area()
3. Download population data from INSEE (dossier complet or Filosofi)
   → Produces: { [code: string]: { population: number } }

4. For each dimension:
   a. DVF: fetch pre-split CSVs from files.data.gouv.fr/geo-dvf/latest/csv/{year}/communes/75/751XX.csv
      - Filter apartments, group mutations, compute median price/m2
      - Fetch previous year for YoY trend
   b. Filosofi: download XLSX from data.gouv.fr, parse with exceljs
      - Extract median income + poverty rate per commune code
   c. SSMSI: download crime CSV, filter 75101-75120
      - Join with population data to compute per-1k rates
   d. IDFM: download station GeoJSON
      - turf.booleanPointInPolygon() each station against arrondissement boundaries
      - Count per arrondissement, divide by area_km2
   e. SIRENE: query INSEE API SIRENE
      - For each arrondissement: GET /siret?q=communeEtablissement:751XX AND activitePrincipaleEtablissement:56.10A,56.30Z,...
      - Paginate, count, divide by area_km2
   f. Green spaces: download GeoJSON from opendata.paris.fr
      - turf.intersect() each park polygon with each arrondissement boundary
      - turf.area() on intersection, sum per arrondissement
      - Divide by population for per-resident metric
   g. Noise: download CSV, already per arrondissement
   h. BPE: download CSV, filter by commune code, count by equipment type, divide by area_km2

5. Normalize all dimension values to 0-100 (min-max across 20 arrondissements)
   - Invert for "lower is better" dimensions (housing price, crime, noise)
6. Output data/arrondissements.json
7. Output data/arrondissements.geojson (boundaries + score properties for map rendering)
```

### Dependencies for build script

- `exceljs` -- XLSX parsing for Filosofi data
- `@turf/turf` -- spatial operations (point-in-polygon, intersect, area)
- `csv-parse` -- streaming CSV parser
- Built-in `fetch` -- downloading files and querying APIs

### Population and area sources

- **Population:** INSEE Filosofi dataset (same download as income data). Field: `NBPERSMENFISC` (number of people in fiscal households) or similar. Alternative: INSEE "dossier complet" population tables.
- **Area:** Computed from GeoJSON boundary polygons via `turf.area()`. More accurate than any published table since it uses the exact same boundaries we render on the map.

### SIRENE query strategy

**Chosen approach: INSEE API SIRENE** (https://api.insee.fr/entreprises/sirene/V3.11)

- Free token required (register at api.insee.fr)
- Rate limit: 30 requests/minute (sufficient for ~20 paginated queries)
- Query pattern: filter by `communeEtablissement` + `activitePrincipaleEtablissement` (NAF codes)
- Token stored in `SIRENE_API_TOKEN` env var (used only in build script, not at runtime)

**Tradeoff vs alternatives:**
- data.gouv.fr Tabular API: simpler auth but 200-row page limit, slower for filtered queries
- Full SIRENE download: 5GB+, overkill for counting restaurants in 20 arrondissements
- Pre-filtered Paris extract: none exists on data.gouv.fr as of writing

## Data Schema

```typescript
type Arrondissement = {
  code: string           // "75109"
  number: number         // 9
  name: string           // "9e arrondissement"
  population: number
  area_km2: number
  dimensions: {
    housing: {
      median_price_m2: number
      yoy_change: number  // percentage
      transaction_count: number
    }
    income: {
      median_household: number
      poverty_rate: number
    }
    safety: {
      crime_rate_per_1k: number
      categories: Record<string, number>
    }
    transport: {
      stations_per_km2: number
      metro_lines: string[]
    }
    nightlife: {
      restaurants_per_km2: number
      bars_per_km2: number
      cafes_per_km2: number
    }
    green_space: {
      m2_per_resident: number
      total_area_m2: number
      park_count: number
    }
    noise: {
      pct_above_lden_threshold: number
      pct_above_night_threshold: number
    }
    amenities: {
      pharmacies: number
      doctors: number
      schools: number
      gyms: number
      cinemas: number
    }
  }
  scores: Record<string, number>  // 0-100 per dimension key
}
```

**Composite score is NOT stored in the JSON.** It depends on persona weights which change client-side. The JSON stores only normalized 0-100 scores per dimension. The client computes `composite = sum(weight[i] * score[i]) / sum(weights)` on every persona switch. For OG images, a default composite is computed using equal weights.

## Pages & Routes

### `/{locale}` -- Home / Map View

- Full-screen interactive map of Paris (MapLibre)
- Arrondissements rendered as colored choropleth polygons
- Color intensity = currently selected dimension's score (or composite score)
- Dimension selector dropdown in toolbar to change what the map shows
- Persona selector dropdown: "Young professional", "Family", "Tourist", "Business owner"
  - Each preset adjusts dimension weights for composite score
- Click arrondissement: side panel slides in (desktop) / bottom sheet slides up (mobile)
  - Shows all dimension scores as a vertical card list
  - "View full details" link to detail page
- Hover arrondissement: tooltip with name + composite score

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

| Dimension | Young Pro | Family | Tourist | Business |
|---|---|---|---|---|
| Housing affordability | 25 | 30 | 5 | 15 |
| Income | 10 | 15 | 0 | 20 |
| Safety | 15 | 25 | 20 | 15 |
| Transport | 20 | 10 | 25 | 10 |
| Nightlife & dining | 20 | 5 | 30 | 15 |
| Green space | 5 | 10 | 10 | 5 |
| Noise | 5 | 15 | 5 | 5 |
| Amenities | 0 | 20 | 5 | 15 |

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
- Tap arrondissement: bottom sheet slides up with summary
- "See details" button navigates to detail page

**Map view (desktop):**

- Map fills left ~65% of viewport
- Click arrondissement: right panel slides in with summary
- Toolbar at top of map area

**Leaderboard (mobile):**

- Vertical card list (one card per arrondissement) instead of wide table
- Or: horizontal-scrollable table with sticky first column
- Dimension filter to show/hide columns

**Detail page (both):**

- Vertical scroll, section per dimension
- Mini-map at top (not interactive, just shows location)

## Social Sharing / OG Images

- Each `/paris/{number}` page generates a dynamic OG image
- Image shows: arrondissement number (large), composite score (equal weights), top 3 dimension scores
- Uses `@vercel/og` (ImageResponse API) in a route handler at `app/api/og/[number]/route.tsx` (**outside** the `[locale]` prefix -- images are language-independent)
- Twitter Card + Open Graph meta tags set per page

## Scoring Algorithm

1. For each dimension, compute a raw value per arrondissement (in build script)
2. Normalize to 0-100 using min-max scaling across all 20 arrondissements
   - Invert for "lower is better" dimensions: housing price, crime rate, noise exposure
   - Higher score = better for the resident, always
3. Store normalized scores in JSON
4. Composite score computed **client-side**: `sum(weight[i] * score[i]) / sum(weights)`
5. Weights come from the active persona preset (or user-adjusted sliders in future)
6. For OG images: compute composite server-side using equal weights

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
    paris-map.tsx           # MapLibre + arrondissement polygons
    map-tooltip.tsx         # hover tooltip
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
  scoring.ts                # normalize, weight, compute composite (client-side)
  i18n.ts                   # next-intl config
  arrondissements.ts        # metadata (names, numbers, colors)
data/
  arrondissements.json      # pre-computed dimension data (committed)
  arrondissements.geojson   # boundary polygons (committed)
  raw/                      # raw downloaded CSVs (gitignored)
scripts/
  build-data.ts             # orchestrator: download, parse, aggregate, output JSON
  sources/
    dvf.ts                  # DVF CSV parsing + median computation
    filosofi.ts             # XLSX parsing for income data
    crime.ts                # SSMSI CSV parsing + per-capita rates
    transport.ts            # IDFM station point-in-polygon
    sirene.ts               # INSEE API SIRENE queries for nightlife/dining
    green-space.ts           # GeoJSON polygon intersection
    noise.ts                # noise CSV parsing
    bpe.ts                  # BPE amenity counting
    normalize.ts            # min-max normalization + inversion
messages/
  fr.json                   # French UI strings
  en.json                   # English UI strings
```

## Environment Variables

| Variable | Where used | Secret? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_MAPTILER_KEY` | Client-side map rendering | No (public) | MapTiler free tier API key. Exposed in browser JS. |
| `SIRENE_API_TOKEN` | Build script only | Yes | INSEE API SIRENE token. Never exposed at runtime. Register at api.insee.fr. |

## Design Approach

Use shadcn/ui defaults (radix-nova preset) throughout. No custom styling until all functionality works. The warm editorial aesthetic (typography, color palette, spacing, personality) is a final polish pass, not a building concern.

## Phasing

### Phase 1: Data Pipeline

1. Download and bundle arrondissement GeoJSON boundaries
2. Build script infrastructure: orchestrator + per-source modules
3. Implement each source parser:
   - DVF (CSV, median computation, outlier trimming)
   - Filosofi (XLSX parsing)
   - SSMSI crime (CSV + population join)
   - IDFM transport (point-in-polygon with turf.js)
   - SIRENE nightlife (INSEE API queries)
   - Green spaces (polygon intersection with turf.js)
   - Noise (straightforward CSV)
   - BPE amenities (CSV filter + count)
4. Normalization to 0-100 scores
5. Output arrondissements.json + arrondissements.geojson
6. TypeScript types for the full data model

### Phase 2: Core Functionality

1. Map view with choropleth, dimension selector, click-to-panel
2. Leaderboard with sortable columns and all dimensions
3. Detail pages with scores and raw values per arrondissement
4. Persona dropdown with 4 presets (fixed weights, no sliders yet)
5. Composite scoring engine (client-side: normalize, weight, rank)

### Phase 3: i18n + Routing

1. next-intl setup with `/{locale}/...` routes
2. FR/EN UI strings for all labels and dimension names
3. Locale switcher component

### Phase 4: Mobile + Responsive

1. Mobile-first layout: bottom sheet on map, card list for leaderboard
2. Desktop layout: side panel on map, wide table for leaderboard
3. Responsive detail page

### Phase 5: Social + Deploy

1. Dynamic OG image generation per arrondissement (@vercel/og)
2. Meta tags per page
3. Deploy to Vercel at quartier.sh

### Phase 6: UI Polish

1. Warm editorial aesthetic: custom typography, color palette, spacing
2. Recharts mini-charts on detail pages (DVF price trend, crime evolution)
3. Map styling refinements (colors, hover states, animations)
4. Loading states, empty states, error states

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
- Filosofi income: https://www.data.gouv.fr/fr/datasets/revenus-et-pauvrete-des-menages-aux-niveaux-national-et-local-revenus-localises-sociaux-et-fiscaux/
- Crime (SSMSI): https://www.data.gouv.fr/fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/
- IDFM stations: https://data.iledefrance-mobilites.fr/explore/dataset/emplacement-des-gares-idf/
- SIRENE: https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/
- SIRENE API: https://api.insee.fr/entreprises/sirene/V3.11
- BPE amenities: https://www.data.gouv.fr/fr/datasets/base-permanente-des-equipements-1/
- Green spaces: https://opendata.paris.fr/explore/dataset/espaces_verts/
- Noise: https://www.data.gouv.fr/fr/datasets/bruit-routier-exposition-des-parisien-ne-s-aux-depassements-des-seuils-nocturne-ou-journee-complete/
- Arrondissement boundaries: https://opendata.paris.fr/explore/dataset/arrondissements/
- Airparif: https://data-airparif-asso.opendata.arcgis.com/
- Velib: https://www.velib-metropole.fr/donnees-open-data-gbfs-du-service-velib-metropole
- Election results: https://www.data.gouv.fr/fr/datasets/elections-presidentielles-1965-2022-2eme-tour/
- INSEE API SIRENE registration: https://api.insee.fr/catalogue/
