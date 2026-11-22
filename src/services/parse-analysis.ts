import type { Finding, IssueCategory, ProductAnalysis, RecurringIssue, Review, SampleStatistics, Verdict } from "@/types/api";

type JsonObject = Record<string, unknown>;

// Centralize the error raised whenever external JSON fails our checks; the form displays this message.
function invalid(): never {
  throw new Error("The server returned an invalid analysis. Please try again.");
}

// Require a real key/value object before reading nested fields; reject null and arrays.
function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as JsonObject;
}

// Require a string instead of coercing unexpected objects or numbers into display text.
function text(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value;
}

// Allow unknown optional text to remain null; validate any supplied value as a string.
function nullableText(value: unknown): string | null {
  return value == null ? null : text(value);
}

// Accept only finite numbers within the caller permitted range; NaN and Infinity are invalid.
function number(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) invalid();
  return value;
}

// Counts must be nonnegative safe whole numbers, not fractions or imprecise huge integers.
function count(value: unknown): number {
  const result = number(value);
  if (!Number.isSafeInteger(result)) invalid();
  // Return validated data for rendering; malformed external JSON never gets silently accepted.
  return result;
}

// Require an actual boolean so strings such as false cannot accidentally act like true.
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

// Require a real array before calling list operations on external JSON.
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalid();
  return value;
}

// Restrict clickable evidence sources to HTTPS Amazon India URLs with no embedded credentials.
function source(value: unknown): string {
  // Read the candidate value as a string before applying URL/date-specific checks.
  const result = text(value);
  try {
    // Parse the URL so the hostname/protocol checks cannot be fooled by similar-looking text.
    const url = new URL(result);
    if (url.protocol !== "https:" || !["amazon.in", "www.amazon.in"].includes(url.hostname) || url.username || url.password || (url.port && url.port !== "443")) invalid();
  } catch {
    invalid();
  }
  // Return validated data for rendering; malformed external JSON never gets silently accepted.
  return result;
}

// Validate an optional ISO calendar date; reject impossible dates that JavaScript would normalize.
function date(value: unknown): string | null {
  const result = nullableText(value);
  if (result !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result)) invalid();
  // Return validated data for rendering; malformed external JSON never gets silently accepted.
  return result;
}

// Accept only known Amazon image hosts before exposing externally supplied image URLs.
function productImage(value: unknown): string | null {
  if (value == null) return null;
  // Read the candidate value as a string before applying URL/date-specific checks.
  const result = text(value);
  try {
    // Parse the URL so the hostname/protocol checks cannot be fooled by similar-looking text.
    const url = new URL(result);
    if (url.protocol !== "https:" || !["m.media-amazon.com", "images-na.ssl-images-amazon.com", "images-eu.ssl-images-amazon.com"].includes(url.hostname) || url.username || url.password || (url.port && url.port !== "443")) invalid();
  } catch { invalid(); }
  // Return validated data for rendering; malformed external JSON never gets silently accepted.
  return result;
}

// Citations must point to distinct reviews actually included in this response.
function references(value: unknown, reviewIds: Set<string>): string[] {
  // Validate every referenced ID as a string before comparing it with the allowed review set.
  const result = array(value).map(text);
  if (!result.length || new Set(result).size !== result.length || result.some(id => !reviewIds.has(id))) invalid();
  // Return validated data for rendering; malformed external JSON never gets silently accepted.
  return result;
}

// Check review IDs and normalized source quotes so malformed findings never reach the report.
function finding(value: unknown, reviews: Review[]): Finding {
  // Validate this nested object before reading its fields; API JSON starts as unknown, not trusted TypeScript data.
  const data = object(value);
  // Make sure this finding cites only distinct reviews actually supplied with the report.
  const reviewIds = references(data.review_ids, new Set(reviews.map(review => review.id)));
  // Validate every quote object attached to the finding.
  const evidence = array(data.evidence).map(value => {
    // Require each quote to contain a review ID and excerpt rather than arbitrary text.
    const quote = object(value);
    // Store the ID whose source review should contain this quote.
    const reviewId = text(quote.review_id);
    // Read the exact quote text that will be shown in the source-excerpts disclosure.
    const excerpt = text(quote.quote);
    // Locate the quoted source in the actual collected review list.
    const review = reviews.find(review => review.id === reviewId);
    // Match backend Unicode/spacing and common case-folding rules before checking excerpt membership.
    const normalize = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase().replace(/ß/g, "ss").replace(/ς/g, "σ");
    // Reject a quote if its review is missing, its ID is undeclared, or its text does not occur in that review.
    if (!review || !reviewIds.includes(reviewId) || !excerpt.trim() || !normalize(review.text).includes(normalize(excerpt))) invalid();
    return { review_id: reviewId, quote: excerpt };
  });
  // Every declared review citation must have at least one matching supporting quote.
  if (!evidence.length || reviewIds.some(id => !evidence.some(quote => quote.review_id === id))) invalid();
  return { text: text(data.text), review_ids: reviewIds, evidence };
}

// Older reports may omit statistics; otherwise validate all count/date fields before using them.
function statistics(value: unknown): SampleStatistics | null {
  if (value == null) return null;
  // Validate this nested object before reading its fields; API JSON starts as unknown, not trusted TypeScript data.
  const data = object(value);
  // Read the per-star count map separately so each of the five buckets is validated.
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

// Unknown API JSON in, trusted ProductAnalysis out; reject inconsistent counts and evidence.
export function parseAnalysis(value: unknown): ProductAnalysis {
  // Validate this nested object before reading its fields; API JSON starts as unknown, not trusted TypeScript data.
  const data = object(value);
  // Get the observed product object before parsing its metadata and histogram.
  const product = object(data.product);
  // Read analysis count and evidence limitations separately from the model verdict.
  const coverage = object(data.coverage);
  // Convert external review objects into the exact frontend source shape, validating each field.
  const reviews = array(data.reviews).map(value => {
    // Treat each array entry as unknown until its review fields pass the checks below.
    const review = object(value);
    return {
      id: text(review.id), title: nullableText(review.title), text: text(review.text),
      stars: review.stars == null ? null : number(review.stars, 1, 5),
      date: nullableText(review.date), date_iso: date(review.date_iso),
      variant: nullableText(review.variant), source_url: source(review.source_url),
    };
  });
  // Build a fast lookup set for later finding references and detect duplicate source IDs.
  const reviewIds = new Set(reviews.map(review => review.id));
  // Reject duplicate or blank IDs because they would make evidence links ambiguous.
  if (reviewIds.size !== reviews.length || reviews.some(review => !review.id.trim())) invalid();
  // Preserve compatibility with saved reports from the earlier two-verdict implementation.
  const verdictAliases: Record<string, Verdict> = {
    buy: "worth_considering", skip: "not_recommended", worth_considering: "worth_considering",
    proceed_with_caution: "proceed_with_caution", not_recommended: "not_recommended", insufficient_evidence: "insufficient_evidence",
  };
  // Read the raw verdict before mapping supported historical aliases to current values.
  const verdictKey = text(data.verdict);
  // Reject unsupported verdicts or response statuses instead of rendering an invented category.
  if (!Object.hasOwn(verdictAliases, verdictKey) || !["completed", "insufficient_evidence"].includes(text(data.status))) invalid();
  // Store the validated current verdict used by styling and report labels.
  const verdict = verdictAliases[verdictKey];
  // Allow older missing histograms as an empty list; validate every supplied star/percentage bucket.
  const distribution = product.rating_distribution != null ? array(product.rating_distribution).map(value => {
    // Read this one histogram entry before checking its star number and percentage.
    const bucket = object(value);
    // A star bucket must be a whole number between one and five.
    const stars = count(bucket.stars);
    if (stars < 1 || stars > 5) invalid();
    return { stars, percentage: bucket.percentage == null ? null : number(bucket.percentage, 0, 100) };
  }) : [];
  // Reject duplicate star buckets so charts cannot double-count or choose an arbitrary duplicate.
  if (new Set(distribution.map(bucket => bucket.stars)).size !== distribution.length) invalid();
  // Allow only known issue categories that the report has display labels for.
  const categories: IssueCategory[] = ["product_defect", "delivery", "subjective_preference", "missing_feature", "usability", "other"];
  // A missing older section remains null; present issues must include validated evidence and counts.
  const issues = data.recurring_issues == null ? null : array(data.recurring_issues).map(value => {
    const issue = object(value);
    // Reuse direct-review quote checks before trusting recurring-issue metadata.
    const result = finding(value, reviews);
    const category = text(issue.category) as IssueCategory;
    // Read the recurring count and compare it with the actual unique supporting review IDs.
    const mentions = count(issue.mention_count);
    // A recurring concern needs at least two citations and an honest count matching those citations.
    if (!categories.includes(category) || mentions < 2 || mentions !== result.review_ids.length) invalid();
    return { ...result, category, mention_count: mentions } satisfies RecurringIssue;
  });
  // Read how many source reviews reached a successfully validated model request.
  const analyzed = count(coverage.reviews_analyzed);
  // The backend cannot legitimately analyze more direct reviews than the response collected.
  if (analyzed > reviews.length) invalid();
  // Sample totals must agree with the supplied reviews; never substitute overall rating percentages.
  const sample = statistics(data.sample_statistics);
  if (sample && (sample.negative_count !== sample.by_star["1"] + sample.by_star["2"] || sample.positive_count !== sample.by_star["4"] + sample.by_star["5"] || sample.neutral_count !== sample.by_star["3"] || sample.negative_count + sample.positive_count + sample.neutral_count + sample.unrated_count !== reviews.length)) invalid();
  // Validate the product identifier before using it in labels and downloaded filenames.
  const asin = text(product.asin);
  // This is Amazon Customers Say text, not the app final model summary.
  const summary = nullableText(product.customers_say);
  // Default absent older topic data to an empty list; validate each supplied topic individually.
  const topics = product.feedback_topics == null ? [] : array(product.feedback_topics).map(value => {
    // Read a single topic object from Amazon secondary evidence.
    const topic = object(value);
    // Only known positive/negative/mixed labels are allowed; optional topics may leave this null.
    const sentiment = nullableText(topic.sentiment);
    if (sentiment !== null && !["positive", "negative", "mixed"].includes(sentiment)) invalid();
    return { name: text(topic.name), sentiment: sentiment as "positive" | "negative" | "mixed" | null,
      mention_count: topic.mention_count == null ? null : count(topic.mention_count),
      positive_count: topic.positive_count == null ? null : count(topic.positive_count),
      negative_count: topic.negative_count == null ? null : count(topic.negative_count), text: nullableText(topic.text) };
  });
  // Validate summary/topic quotes against their own sources rather than inventing review citations.
  const amazonFindings = data.amazon_findings == null ? [] : array(data.amazon_findings).map(value => {
    const finding = object(value);
    // Keep summary and named-topic evidence distinguishable during validation and rendering.
    const sourceType = text(finding.source);
    // Read the topic reference; a summary-source finding must use null instead.
    const topicName = nullableText(finding.topic);
    // Only known positive/negative/mixed labels are allowed; optional topics may leave this null.
    const sentiment = text(finding.sentiment);
    if (!["customers_say", "topic"].includes(sourceType) || !["positive", "negative", "mixed"].includes(sentiment)) invalid();
    // Find the exact supplied topic named by this model finding, if any.
    const topic = topics.find(t => t.name === topicName);
    // Choose only the corresponding supplied summary/topic text for quote verification.
    const sourceText = sourceType === "customers_say" && topicName === null ? summary : sourceType === "topic" ? (topic?.text || topic?.name) : null;
    // Require nonempty source-backed quote text before showing an Amazon AI finding.
    const quote = text(finding.quote);
    // Match backend Unicode/spacing and common case-folding rules before checking excerpt membership.
    const normalize = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase().replace(/ß/g, "ss").replace(/ς/g, "σ");
    // Reject unsupported quotes, unknown topic evidence or sentiment disagreement with its explicit source.
    if (!sourceText || !quote.trim() || !normalize(sourceText).includes(normalize(quote)) || (sourceType === "topic" && (!topic?.text && !topic?.sentiment)) || (sourceType === "topic" && topic?.sentiment && topic.sentiment !== sentiment)) invalid();
    return { text: text(finding.text), source: sourceType as "customers_say" | "topic", topic: topicName, quote, sentiment: sentiment as "positive" | "negative" | "mixed" };
  });
  if (!/^[A-Z0-9]{10}$/.test(asin)) invalid();
  // Construct the typed frontend report only from fields that passed these runtime checks.
  const result: ProductAnalysis = {
    status: data.status as ProductAnalysis["status"],
    product: {
      asin, title: text(product.title), url: source(product.url),
      overall_rating: product.overall_rating == null ? null : number(product.overall_rating, 1, 5),
      rating_count: product.rating_count == null ? null : count(product.rating_count),
      rating_distribution: distribution,
      image_url: productImage(product.image_url), price_text: nullableText(product.price_text),
      specifications: product.specifications == null ? [] : array(product.specifications).map(value => {
        const spec = object(value);
        return { label: text(spec.label), value: text(spec.value) };
      }),
      customers_say: summary, feedback_topics: topics,
    },
    verdict, summary: text(data.summary), reviews,
    reasons: array(data.reasons).map(value => {
      const reason = object(value);
      return { text: text(reason.text), review_ids: references(reason.review_ids, reviewIds) };
    }),
    positive_findings: data.positive_findings == null ? null : array(data.positive_findings).map(value => finding(value, reviews)),
    negative_findings: data.negative_findings == null ? null : array(data.negative_findings).map(value => finding(value, reviews)),
    recurring_issues: issues, sample_statistics: sample,
    reliability_findings: data.reliability_findings == null ? null : array(data.reliability_findings).map(value => finding(value, reviews)),
    key_takeaway: nullableText(data.key_takeaway),
    amazon_findings: amazonFindings,
    coverage: { reviews_analyzed: analyzed, limitations: array(coverage.limitations).map(text) },
    cached: boolean(data.cached),
  };
  // Usage is optional for older reports; validate the reservation metadata when it is present.
  if (data.usage != null) {
    const usage = object(data.usage);
    result.usage = {
      model: text(usage.model), reserved_cost_usd: number(usage.reserved_cost_usd),
      daily_reserved_usd: number(usage.daily_reserved_usd), lifetime_reserved_usd: number(usage.lifetime_reserved_usd),
      paid_attempts_today: count(usage.paid_attempts_today), cached: boolean(usage.cached),
    };
  }
  // Return validated data for rendering; malformed external JSON never gets silently accepted.
  return result;
}
