import type { ProductAnalysis, Review } from "@/types/api";

export const verdictLabels = {
  worth_considering: "Worth Considering", proceed_with_caution: "Proceed with Caution",
  not_recommended: "Not Recommended", insufficient_evidence: "More Evidence Needed",
};

export function overallPercentages(distribution: ProductAnalysis["product"]["rating_distribution"]) {
  const sum = (stars: number[]) => {
    const values = stars.map(star => distribution.find(bucket => bucket.stars === star)?.percentage);
    if (values.some(value => value == null)) return null;
    const total = values.reduce<number>((total, value) => total + value!, 0);
    return total <= 100 ? Math.round(total * 10) / 10 : null;
  };
  return { positive: sum([4, 5]), neutral: sum([3]), negative: sum([1, 2]) };
}

export function sampleGroups(reviews: Review[]) {
  return [
    { label: "Positive", range: "4★–5★", count: reviews.filter(r => r.stars === 4 || r.stars === 5).length, tone: "positive" },
    { label: "Neutral", range: "3★", count: reviews.filter(r => r.stars === 3).length, tone: "neutral" },
    { label: "Negative", range: "1★–2★", count: reviews.filter(r => r.stars === 1 || r.stars === 2).length, tone: "negative" },
    { label: "Unrated", range: "", count: reviews.filter(r => ![1, 2, 3, 4, 5].includes(r.stars ?? 0)).length, tone: "unrated" },
  ];
}

export function reportText(result: ProductAnalysis): string {
  const product = result.product;
  const section = (title: string, findings: ProductAnalysis["positive_findings"]) => [title,
    ...(findings?.length ? findings.map(f => `${f.text}\nReferences: ${f.review_ids.join(", ")}\n${f.evidence.map(e => `${e.review_id}: “${e.quote}”`).join("\n")}`) : ["No supported findings available."]), ""];
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
    "Up to 7 per category; deliberately balanced and not a measure of overall satisfaction.", "",
    ...section("WHAT BUYERS LIKE", result.positive_findings), ...section("COMMON CONCERNS", result.negative_findings),
    ...section("RELIABILITY INSIGHTS", result.reliability_findings),
    "RECURRING ISSUES", ...(result.recurring_issues ?? []).map(i => `${i.text} — ${i.category}; ${i.mention_count} cited reviews (${i.review_ids.join(", ")})`), "",
    ...(result.reasons.length ? ["ADDITIONAL VERDICT REFERENCES", ...result.reasons.map(r => `${r.text} (${r.review_ids.join(", ")})`), ""] : []),
    "EVIDENCE LIMITATIONS", ...result.coverage.limitations, "", "SUPPORTING REVIEWS",
    ...result.reviews.map((r, i) => `Review ${i + 1} (${r.id}) — ${r.stars ?? "Unrated"}/5\n${r.title ?? ""}\n${r.date ?? "Date unavailable"}\n${r.variant ?? ""}\n${r.text}\n${r.source_url}\n`),
    `Cached result: ${result.cached ? "Yes" : "No"}`, "This report reflects accessible evidence at collection time; availability and prices may change.",
  ].join("\n");
}
