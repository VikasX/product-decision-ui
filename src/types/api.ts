// The health hook returns one of these three UI states; connected only proves backend liveness.
export type ConnectionStatus = "checking" | "connected" | "unavailable";

// Keep exactly the four backend verdict values so labels and styling stay predictable.
export type Verdict = "worth_considering" | "proceed_with_caution" | "not_recommended" | "insufficient_evidence";
// A quote identifies the direct review that must actually contain its text.
export type Evidence = { review_id: string; quote: string };
// A finding combines its explanation, declared source IDs and supporting exact quotes.
export type Finding = { text: string; review_ids: string[]; evidence: Evidence[] };
// Topic mentions belong to Amazon AI summaries and must not be interpreted as failure rates.
export type FeedbackTopic = { name: string; sentiment: "positive" | "negative" | "mixed" | null; mention_count: number | null; positive_count: number | null; negative_count: number | null; text: string | null };
// Amazon AI findings use summary/topic sources rather than direct-review IDs.
export type AmazonFinding = { text: string; sentiment: "positive" | "negative" | "mixed"; source: "customers_say" | "topic"; topic: string | null; quote: string };
// Separate reported defects, delivery problems and personal preferences instead of merging every complaint.
export type IssueCategory = "product_defect" | "delivery" | "subjective_preference" | "missing_feature" | "usability" | "other";
// Extend a normal finding with its issue category and count of distinct supporting reviews.
export type RecurringIssue = Finding & { category: IssueCategory; mention_count: number };
// Describe one observed written source, including optional metadata when Amazon omitted fields.
export type Review = {
  // Stable source ID connects the review panel with finding links and quote validation.
  id: string;
  // Observed product/review title; optional review titles may be unavailable.
  title: string | null;
  // The actual written review content; the frontend parser verifies finding excerpts against this text.
  text: string;
  // Observed review rating or null; the sample ring groups these star values, not inferred text sentiment.
  stars: number | null;
  // Original date label from the source page, retained for display.
  date: string | null;
  // Recognized YYYY-MM-DD date for ordering and date-range display, or null when unknown.
  date_iso: string | null;
  // Source variation text can warn that a review describes another version of the product.
  variant: string | null;
  // Validated HTTPS Amazon link for inspecting the original evidence.
  source_url: string;
};
// These counts and date bounds describe collected reviews only, not all ratings on Amazon.
export type SampleStatistics = {
  // Record maps each exact star number to its sample count; the parser checks all five entries.
  by_star: Record<"1" | "2" | "3" | "4" | "5", number>;
  // Number of collected one- and two-star reviews, not an overall complaint percentage.
  negative_count: number;
  // Number of collected four- and five-star reviews.
  positive_count: number;
  // Number of collected reviews rated exactly three stars.
  neutral_count: number;
  // Keep missing/unrecognized exact star values separate so the sample total remains honest.
  unrated_count: number;
  // Earliest recognized date among collected source reviews, not the first review on Amazon.
  oldest_review_date: string | null;
  // Latest recognized date among collected source reviews; missing dates stay unknown.
  newest_review_date: string | null;
};
// Frontend report contract mirrors FastAPI; parseAnalysis enforces it at runtime.
export type ProductAnalysis = {
  // A report may be structurally valid while honestly saying more evidence is needed.
  status: "completed" | "insufficient_evidence";
  // Observed listing metadata and Amazon secondary evidence travel together in this nested object.
  product: {
    // Amazon product ID used in the UI, backend canonical URL and download filename.
    asin: string;
    // Observed product/review title; optional review titles may be unavailable.
    title: string;
    // Canonical product URL supplied by the backend after request validation.
    url: string;
    // Listing average out of five; not recalculated from our small written-review sample.
    overall_rating: number | null;
    // Overall listing ratings count; distinct from result.reviews.length.
    rating_count: number | null;
    // Observed listing percentages for each available star bucket; missing values stay null.
    rating_distribution: { stars: number; percentage: number | null }[];
    // Optional Amazon-hosted product image checked by the runtime parser.
    image_url: string | null;
    // Observed display price, which may change after collection.
    price_text: string | null;
    // Observed overview labels/values for display, not generated product facts.
    specifications: { label: string; value: string }[];
    // Optional Amazon AI customer summary, distinct from our final verdict summary.
    customers_say: string | null;
    // Amazon AI topics retain their explicit sentiment and optional mention counts.
    feedback_topics: FeedbackTopic[];
  };
  // Validated backend conclusion used to choose the displayed verdict label and colors.
  verdict: Verdict;
  // The backend explanation accompanying the final verdict.
  summary: string;
  // Compatibility reasons list used when older reports lack detailed finding sections.
  reasons: { text: string; review_ids: string[] }[];
  // Null supports older saved reports; an empty array means no supported finding in this section.
  positive_findings: Finding[] | null;
  // Supported direct-review concerns, each with checked source IDs and quotes.
  negative_findings: Finding[] | null;
  // Validated repeated direct-review concerns with two or more distinct citations.
  recurring_issues: RecurringIssue[] | null;
  // Optional backend-computed counts/date bounds, independently checked against the review array.
  sample_statistics: SampleStatistics | null;
  // Supported reliability observations; these do not claim long-term independent testing.
  reliability_findings: Finding[] | null;
  // Optional short practical conclusion shown below the findings.
  key_takeaway: string | null;
  // Source-checked claims based on Amazon AI summaries/topics, labeled separately in the UI.
  amazon_findings: AmazonFinding[];
  // Collected direct written evidence displayed in expandable source panels.
  reviews: Review[];
  // How many reviews reached successful AI analysis, plus limitations affecting the report.
  coverage: { reviews_analyzed: number; limitations: string[] };
  // Whether the service reused a stored analysis rather than making a new model call.
  cached: boolean;
  // Older reports may omit usage; present values report app-side reservations, not billed OpenAI charges.
  usage?: {
    // Configured allowed model name used by the backend.
    model: string;
    // Conservative maximum amount reserved for this attempt.
    reserved_cost_usd: number;
    // All reservations for the current Asia/Calcutta budget day.
    daily_reserved_usd: number;
    // All retained reservations in this store, including attempts whose responses failed.
    lifetime_reserved_usd: number;
    // Count of reserved attempts today, which is capped independently of dollar amounts.
    paid_attempts_today: number;
    // Whether the service reused a stored analysis rather than making a new model call.
    cached: boolean;
  };
};
