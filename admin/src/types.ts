export type FuelType = "gasolina" | "etanol" | "diesel";

export interface FuelPrice {
  price: number;
  confidenceScore: number;
  priceChangedAt: string;
}

export interface Station {
  id: string;
  cnpj: string | null;
  nomeFantasia: string;
  razaoSocial: string | null;
  brand: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressNeighborhood: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  cityId: string;
  source: string;
  verified: boolean;
  status: "active" | "inactive" | "pending_review";
  createdAt: string;
  updatedAt: string | null;
  prices: Partial<Record<FuelType, FuelPrice>>;
}

export interface StationInput {
  nomeFantasia: string;
  razaoSocial?: string;
  cnpj?: string;
  brand?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressNeighborhood?: string;
  city: string;
  state: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  cityId: string;
}

export type StationPricesInput = Partial<Record<FuelType, number>>;

export interface PriceHistoryEntry {
  id: string;
  fuelType: FuelType;
  price: number;
  previousPrice: number | null;
  source: "admin" | "user_report";
  changedBy: string | null;
  changedAt: string;
}

export interface PriceReport {
  id: string;
  gasStationId: string;
  stationName: string;
  fuelType: FuelType;
  price: number;
  pixDiscount: boolean;
  cashDiscount: boolean;
  reporterEmail: string;
  distanceFromStationM: number | null;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  trustScore: number;
  status: "active" | "shadow_banned" | "banned";
  createdAt: string;
}

export interface RankingWeights {
  price: number;
  distance: number;
  rating: number;
}

export interface PriceBounds {
  min: number;
  max: number;
}

export interface Config {
  rankingWeights: RankingWeights;
  priceBounds: PriceBounds;
}

export interface Metrics {
  stationsCount: number;
  usersCount: number;
  reportsCount: number;
  fillUpsCount: number;
  activeUsersCount: number;
  verifiedStationsCount: number;
}
