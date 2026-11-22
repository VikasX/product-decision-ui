import type { ProductAnalysis, Review } from "@/types/api";

// Keep readable labels in one place for the rendered report and its text export.
export const verdictLabels = {
  worth_considering: "Worth Considering", proceed_with_caution: "Proceed with Caution",
  not_recommended: "Not Recommended", insufficient_evidence: "More Evidence Needed",
};

// Sum observed 4+5, 3 and 1+2 star buckets; missing components stay unknown, not zero.
export function overallPercentages(distribution: ProductAnalysis["product"]["rating_distribution"]) {
  // This local helper adds only the requested star buckets, preserving missing data as unknown.
  const sum = (stars: number[]) => {
    // Look up each requested percentage; optional chaining returns undefined when its bucket is absent.
    const values = stars.map(star => distribution.find(bucket => bucket.stars === star)?.percentage);
    // A partial group is not a complete percentage, so do not present it as one.
    if (values.some(value => value == null)) return null;
    // Add the known numeric bucket values after the missing-data check above.
    const total = values.reduce<number>((total, value) => total + value!, 0);
    // Reject impossible totals and round valid display values to one decimal place.
    return total <= 100 ? Math.round(total * 10) / 10 : null;
  };
  // Overall positive means 4+5 stars, neutral means 3 stars, and negative means 1+2 stars.
  return { positive: sum([4, 5]), neutral: sum([3]), negative: sum([1, 2]) };
}

// This is a rating-based display summary, not a replacement for the stored AI verdict.
export function ratingOverview(product: ProductAnalysis["product"]) {
  const positive = overallPercentages(product.rating_distribution).positive;
  const concerns = product.feedback_topics.filter(t => t.sentiment === "negative").slice(0, 2);
  return {
    title: positive == null ? "Positive ratings unavailable" : `${positive}% Positive Ratings`,
    summary: concerns.length
      ? `Reported concerns: ${concerns.map(t => t.name).join(" and ")}.`
      : "Based on Amazon’s overall 4–5★ rating share.",
  };
}

// Keep display text short without generating new claims or changing the saved source.
export function shortText(text: string, limit = 160): string {
  if (text.length <= limit) return text;
  const end = text.lastIndexOf(" ", limit - 1);
  return text.slice(0, end > 0 ? end : limit - 1).trimEnd() + "…";
}

// Counts describe only accessible collected reviews, not overall buyer satisfaction.
export function sampleGroups(reviews: Review[]) {
  // Create the displayed output from existing data only; this function does not contact any service.
  return [
    // Count only reviews rated exactly four or five; wording is not independently sentiment-classified here.
    { label: "Positive", range: "4★–5★", count: reviews.filter(r => r.stars === 4 || r.stars === 5).length, tone: "positive" },
    // Three-star reviews form the neutral rating group even if their written text is mixed.
    { label: "Neutral", range: "3★", count: reviews.filter(r => r.stars === 3).length, tone: "neutral" },
    // One- and two-star reviews form the low-rating group used in the sample ring.
    { label: "Negative", range: "1★–2★", count: reviews.filter(r => r.stars === 1 || r.stars === 2).length, tone: "negative" },
    // Keep missing/unrecognized exact stars separate so those reviews remain in the sample total.
    { label: "Unrated", range: "", count: reviews.filter(r => ![1, 2, 3, 4, 5].includes(r.stars ?? 0)).length, tone: "unrated" },
  ];
}

// Convert an existing validated report to text with sources/limitations; no network or AI work.
export function reportText(result: ProductAnalysis): string {
  // Use the same observed product fields as the on-screen report.
  const product = result.product;
  // Format a heading, findings, citation IDs and source excerpts for each written-evidence section.
  const section = (title: string, findings: ProductAnalysis["positive_findings"]) => [title,
    ...(findings?.length ? findings.map(f => `${f.text}\nReferences: ${f.review_ids.join(", ")}\n${f.evidence.map(e => `${e.review_id}: “${e.quote}”`).join("\n")}`) : ["No supported findings available."]), ""];
  // Create the displayed output from existing data only; this function does not contact any service.
  // Assemble text lines from the current report, including unavailable values, sources and limitations.
  return ["BUYWISE AI — PRODUCT REVIEW REPORT", product.title, product.url, `ASIN: ${product.asin}`,
    ...(product.price_text ? [`Observed price: ${product.price_text} (may change)`] : []),
    ...product.specifications.map(s => `${s.label}: ${s.value}`), "",
    `FINAL VERDICT: ${verdictLabels[result.verdict]}`, result.summary,
    ...(result.key_takeaway ? [`Key takeaway: ${result.key_takeaway}`] : []), "",
    "AMAZON OVERALL RATINGS (not the balanced review sample)",
    `Rating: ${product.overall_rating ?? "Unavailable"} / 5; Rating count: ${product.rating_count ?? "Unavailable"}`,
    ...[5, 4, 3, 2, 1].map(star => { const p = product.rating_distribution.find(b => b.stars === star)?.percentage; return `${star}★: ${p == null ? "Unavailable" : `${p}%`}`; }), "",
    `WRITTEN REVIEW SAMPLE: ${result.reviews.length} collected; ${result.coverage.reviews_analyzed} AI analyzed`,
    ...sampleGroups(result.reviews).map(g => `${g.label}: ${g.count}`),
    "Accessible product-page sample, not a measure of overall satisfaction.", "",
    ...section("WHAT BUYERS LIKE", result.positive_findings), ...section("COMMON CONCERNS", result.negative_findings),
    ...section("RELIABILITY INSIGHTS", result.reliability_findings),
    "RECURRING ISSUES", ...(result.recurring_issues ?? []).map(i => `${i.text} — ${i.category}; ${i.mention_count} cited reviews (${i.review_ids.join(", ")})`), "",
    ...(result.reasons.length ? ["ADDITIONAL VERDICT REFERENCES", ...result.reasons.map(r => `${r.text} (${r.review_ids.join(", ")})`), ""] : []),
    "AMAZON AI-GENERATED CUSTOMER SUMMARY", product.customers_say ?? "Unavailable",
    ...product.feedback_topics.map(t => `${t.name}: ${t.sentiment ?? "Unknown"}; mentions: ${t.mention_count ?? "Unavailable"}${t.text ? ` — ${t.text}` : ""}`),
    ...result.amazon_findings.map(f => `${f.text} — Amazon ${f.source}${f.topic ? ` (${f.topic})` : ""}: “${f.quote}”`),
    "Topic mentions are not failure rates.", "",
    "EVIDENCE LIMITATIONS", ...result.coverage.limitations, "", "SUPPORTING REVIEWS",
    ...result.reviews.map((r, i) => `Review ${i + 1} (${r.id}) — ${r.stars ?? "Unrated"}/5\n${r.title ?? ""}\n${r.date ?? "Date unavailable"}\n${r.variant ?? ""}\n${r.text}\n${r.source_url}\n`),
    `Cached result: ${result.cached ? "Yes" : "No"}`, "This report reflects accessible evidence at collection time; availability and prices may change.",
  ].join("\n");
}
