import type { Finding, IssueCategory, ProductAnalysis, RecurringIssue, Review, SampleStatistics, Verdict } from "@/types/api";

type JsonObject = Record<string, unknown>;

function invalid(): never {
  throw new Error("The server returned an invalid analysis. Please try again.");
}

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as JsonObject;
}

function text(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value;
}

function nullableText(value: unknown): string | null {
  return value == null ? null : text(value);
}

function number(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) invalid();
  return value;
}

function count(value: unknown): number {
  const result = number(value);
  if (!Number.isSafeInteger(result)) invalid();
  return result;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalid();
  return value;
}

function source(value: unknown): string {
  const result = text(value);
  try {
    const url = new URL(result);
    if (url.protocol !== "https:" || !["amazon.in", "www.amazon.in"].includes(url.hostname) || url.username || url.password || (url.port && url.port !== "443")) invalid();
  } catch {
    invalid();
  }
  return result;
}

function date(value: unknown): string | null {
  const result = nullableText(value);
  if (result !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result)) invalid();
  return result;
}

function references(value: unknown, reviewIds: Set<string>): string[] {
  const result = array(value).map(text);
  if (!result.length || new Set(result).size !== result.length || result.some(id => !reviewIds.has(id))) invalid();
  return result;
}

function finding(value: unknown, reviews: Review[]): Finding {
  const data = object(value);
  const reviewIds = references(data.review_ids, new Set(reviews.map(review => review.id)));
  const evidence = array(data.evidence).map(value => {
    const quote = object(value);
    const reviewId = text(quote.review_id);
    const excerpt = text(quote.quote);
    const review = reviews.find(review => review.id === reviewId);
    const normalize = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase().replace(/ß/g, "ss").replace(/ς/g, "σ");
    if (!review || !reviewIds.includes(reviewId) || !excerpt.trim() || !normalize(review.text).includes(normalize(excerpt))) invalid();
    return { review_id: reviewId, quote: excerpt };
  });
  if (!evidence.length || reviewIds.some(id => !evidence.some(quote => quote.review_id === id))) invalid();
  return { text: text(data.text), review_ids: reviewIds, evidence };
}

function statistics(value: unknown): SampleStatistics | null {
  if (value == null) return null;
  const data = object(value);
  const stars = object(data.by_star);
  return {
    by_star: { "1": count(stars["1"]), "2": count(stars["2"]), "3": count(stars["3"]), "4": count(stars["4"]), "5": count(stars["5"]) },
    negative_count: count(data.negative_count),
    positive_count: count(data.positive_count),
    neutral_count: count(data.neutral_count),
    unrated_count: count(data.unrated_count),
    oldest_review_date: date(data.oldest_review_date),
    newest_review_date: date(data.newest_review_date),
  };
}

export function parseAnalysis(value: unknown): ProductAnalysis {
  const data = object(value);
  const product = object(data.product);
  const coverage = object(data.coverage);
  const reviews = array(data.reviews).map(value => {
    const review = object(value);
    return {
      id: text(review.id), title: nullableText(review.title), text: text(review.text),
      stars: review.stars == null ? null : number(review.stars, 1, 5),
      date: nullableText(review.date), date_iso: date(review.date_iso),
      variant: nullableText(review.variant), source_url: source(review.source_url),
    };
  });
  const reviewIds = new Set(reviews.map(review => review.id));
  if (reviewIds.size !== reviews.length || reviews.some(review => !review.id.trim())) invalid();
  const verdictAliases: Record<string, Verdict> = {
    buy: "worth_considering", skip: "not_recommended", worth_considering: "worth_considering",
    proceed_with_caution: "proceed_with_caution", not_recommended: "not_recommended", insufficient_evidence: "insufficient_evidence",
  };
  const verdictKey = text(data.verdict);
  if (!Object.hasOwn(verdictAliases, verdictKey) || !["completed", "insufficient_evidence"].includes(text(data.status))) invalid();
  const verdict = verdictAliases[verdictKey];
  const distribution = product.rating_distribution != null ? array(product.rating_distribution).map(value => {
    const bucket = object(value);
    const stars = count(bucket.stars);
    if (stars < 1 || stars > 5) invalid();
    return { stars, percentage: bucket.percentage == null ? null : number(bucket.percentage, 0, 100) };
  }) : [];
  if (new Set(distribution.map(bucket => bucket.stars)).size !== distribution.length) invalid();
  const categories: IssueCategory[] = ["product_defect", "delivery", "subjective_preference", "missing_feature", "usability", "other"];
  const issues = data.recurring_issues == null ? null : array(data.recurring_issues).map(value => {
    const issue = object(value);
    const result = finding(value, reviews);
    const category = text(issue.category) as IssueCategory;
    const mentions = count(issue.mention_count);
    if (!categories.includes(category) || mentions < 2 || mentions !== result.review_ids.length) invalid();
    return { ...result, category, mention_count: mentions } satisfies RecurringIssue;
  });
  const analyzed = count(coverage.reviews_analyzed);
  if (analyzed > reviews.length) invalid();
  const sample = statistics(data.sample_statistics);
  if (sample && (sample.negative_count !== sample.by_star["1"] + sample.by_star["2"] || sample.positive_count !== sample.by_star["4"] + sample.by_star["5"] || sample.neutral_count !== sample.by_star["3"] || sample.negative_count + sample.positive_count + sample.neutral_count + sample.unrated_count !== reviews.length)) invalid();
  const asin = text(product.asin);
  if (!/^[A-Z0-9]{10}$/.test(asin)) invalid();
  const result: ProductAnalysis = {
    status: data.status as ProductAnalysis["status"],
    product: {
      asin, title: text(product.title), url: source(product.url),
      overall_rating: product.overall_rating == null ? null : number(product.overall_rating, 1, 5),
      rating_count: product.rating_count == null ? null : count(product.rating_count),
      rating_distribution: distribution,
    },
    verdict, summary: text(data.summary), reviews,
    reasons: array(data.reasons).map(value => {
      const reason = object(value);
      return { text: text(reason.text), review_ids: references(reason.review_ids, reviewIds) };
    }),
    positive_findings: data.positive_findings == null ? null : array(data.positive_findings).map(value => finding(value, reviews)),
    negative_findings: data.negative_findings == null ? null : array(data.negative_findings).map(value => finding(value, reviews)),
    recurring_issues: issues, sample_statistics: sample,
    coverage: { reviews_analyzed: analyzed, limitations: array(coverage.limitations).map(text) },
    cached: boolean(data.cached),
  };
  if (data.usage != null) {
    const usage = object(data.usage);
    result.usage = {
      model: text(usage.model), reserved_cost_usd: number(usage.reserved_cost_usd),
      daily_reserved_usd: number(usage.daily_reserved_usd), lifetime_reserved_usd: number(usage.lifetime_reserved_usd),
      paid_attempts_today: count(usage.paid_attempts_today), cached: boolean(usage.cached),
    };
  }
  return result;
}
