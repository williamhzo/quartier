import type { PersonaKey, PersonaWeights } from "./types";

export const PERSONA_WEIGHTS: Record<PersonaKey, PersonaWeights> = {
  youngPro: {
    housing: 25,
    income: 10,
    safety: 15,
    transport: 20,
    nightlife: 20,
    greenSpace: 5,
    noise: 5,
    amenities: 0,
  },
  family: {
    housing: 30,
    income: 15,
    safety: 25,
    transport: 10,
    nightlife: 5,
    greenSpace: 10,
    noise: 15,
    amenities: 20,
  },
  tourist: {
    housing: 5,
    income: 0,
    safety: 20,
    transport: 25,
    nightlife: 30,
    greenSpace: 10,
    noise: 5,
    amenities: 5,
  },
  business: {
    housing: 15,
    income: 20,
    safety: 15,
    transport: 10,
    nightlife: 15,
    greenSpace: 5,
    noise: 5,
    amenities: 15,
  },
};

export const EQUAL_WEIGHTS: PersonaWeights = {
  housing: 1,
  income: 1,
  safety: 1,
  transport: 1,
  nightlife: 1,
  greenSpace: 1,
  noise: 1,
  amenities: 1,
};
