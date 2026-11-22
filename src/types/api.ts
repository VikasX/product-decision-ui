export type ConnectionStatus = "checking" | "connected" | "unavailable";

export type Verdict = "worth_considering" | "proceed_with_caution" | "not_recommended" | "insufficient_evidence";
export type Evidence = { review_id: string; quote: string };
export type Finding = { text: string; review_ids: string[]; evidence: Evidence[] };
export type IssueCategory = "product_defect" | "delivery" | "subjective_preference" | "missing_feature" | "usability" | "other";
export type RecurringIssue = Finding & { category: IssueCategory; mention_count: number };
export type Review = {
  id: string;
  title: string | null;
  text: string;
  stars: number | null;
  date: string | null;
  date_iso: string | null;
  variant: string | null;
  source_url: string;
};
export type SampleStatistics = {
  by_star: Record<"1" | "2" | "3" | "4" | "5", number>;
  negative_count: number;
  positive_count: number;
  neutral_count: number;
  unrated_count: number;
  oldest_review_date: string | null;
  newest_review_date: string | null;
};
export type ProductAnalysis = {
  status: "completed" | "insufficient_evidence";
  product: {
    asin: string;
    title: string;
    url: string;
    overall_rating: number | null;
    rating_count: number | null;
    rating_distribution: { stars: number; percentage: number | null }[];
  };
  verdict: Verdict;
  summary: string;
  reasons: { text: string; review_ids: string[] }[];
  positive_findings: Finding[] | null;
  negative_findings: Finding[] | null;
  recurring_issues: RecurringIssue[] | null;
  sample_statistics: SampleStatistics | null;
  reviews: Review[];
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
