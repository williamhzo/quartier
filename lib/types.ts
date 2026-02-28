export type DimensionKey =
  | "housing"
  | "income"
  | "safety"
  | "transport"
  | "nightlife"
  | "greenSpace"
  | "noise"
  | "amenities"
  | "culture"
  | "sports";

export type HousingData = {
  median_price_m2: number;
  yoy_change: number;
  transaction_count: number;
};

export type IncomeData = {
  median_household: number;
  poverty_rate: number;
};

export type SafetyData = {
  crime_rate_per_1k: number;
  categories: Record<string, number>;
};

export type TransportData = {
  stations_per_km2: number;
  metro_lines: string[];
};

export type NightlifeData = {
  restaurants_per_km2: number;
  bars_per_km2: number;
  cafes_per_km2: number;
};

export type GreenSpaceData = {
  m2_per_resident: number;
  total_area_m2: number;
  park_count: number;
};

export type NoiseData = {
  pct_above_lden_threshold: number;
  pct_above_night_threshold: number;
};

export type AmenitiesData = {
  pharmacies: number;
  doctors: number;
  schools: number;
  gyms: number;
  cinemas: number;
};

export type CultureData = {
  cultural_buildings_total: number;
  cultural_buildings_per_km2: number;
  cultural_buildings_per_10k_residents: number;
  by_type: {
    cinemas: number;
    libraries: number;
    heritage: number;
    livePerformanceVenues: number;
    archives: number;
    museums: number;
  };
};

export type SportsData = {
  facilities_total: number;
  facilities_per_km2: number;
  facilities_per_10k_residents: number;
  by_type: {
    fitness: number;
    tennis: number;
    swimming: number;
    multisport: number;
    combat: number;
    athletics: number;
    team_sports: number;
  };
};

export type Dimensions = {
  housing: HousingData | null;
  income: IncomeData | null;
  safety: SafetyData | null;
  transport: TransportData | null;
  nightlife: NightlifeData | null;
  greenSpace: GreenSpaceData | null;
  noise: NoiseData | null;
  amenities: AmenitiesData | null;
  culture: CultureData | null;
  sports: SportsData | null;
};

export type Arrondissement = {
  code: string;
  number: number;
  name: string;
  population: number;
  area_km2: number;
  dimensions: Dimensions;
  scores: Record<DimensionKey, number | null>;
};

export type PersonaKey = "youngPro" | "family" | "tourist" | "business";

export type PersonaWeights = Record<DimensionKey, number>;
