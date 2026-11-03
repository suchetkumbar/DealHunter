export type Business = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  website: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
};

export type GeoPoint = {
  lat: number;
  lon: number;
  label: string;
};

export type PlacesResponse = {
  center: GeoPoint;
  radiusM: number;
  businesses: Business[];
};

export type SignalId =
  | "website"
  | "reachable"
  | "https"
  | "speed"
  | "mobile"
  | "chat"
  | "booking"
  | "analytics"
  | "platform"
  | "freshness"
  | "contact"
  | "social"
  | "reviews"
  | "certificate"
  | "links";

export type Signal = {
  id: SignalId;
  label: string;
  passed: boolean;
  detail: string;
  /** Short line an agency could use when pitching a fix for this gap. */
  pitch?: string;
};

export type Verdict = "prime" | "warm" | "saturated";

export type AnalysisReport = {
  url: string | null;
  reachable: boolean;
  /** 0–100: how digitally mature the business already is. */
  maturity: number;
  /** 0–100: inverse of maturity — how much there is to sell. */
  opportunity: number;
  verdict: Verdict;
  signals: Signal[];
  detectedTools: string[];
  responseMs: number | null;
};

export type ApiError = { error: string };
