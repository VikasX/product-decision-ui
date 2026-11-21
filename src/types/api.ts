export type ConnectionStatus = "checking" | "connected" | "unavailable";

export type ProductAnalysis = {
  status: "completed" | "insufficient_evidence";
  product: { asin: string; title: string; url: string };
  verdict: "buy" | "skip" | "insufficient_evidence";
  summary: string;
  reasons: { text: string; review_ids: string[] }[];
  reviews: {
    id: string;
    text: string;
    stars: number | null;
    date: string | null;
    variant: string | null;
    source_url: string;
  }[];
  coverage: { reviews_analyzed: number; limitations: string[] };
  cached: boolean;
  usage?: {
    model: string;
    reserved_cost_usd: number;
    daily_reserved_usd: number;
    lifetime_reserved_usd: number;
    paid_attempts_today: number;
    cached: boolean;
  };
};
