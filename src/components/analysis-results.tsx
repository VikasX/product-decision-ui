import { ExternalLink } from "lucide-react";
import type { Finding, ProductAnalysis, Review, Verdict } from "@/types/api";

const verdictLabels: Record<Verdict, string> = {
  worth_considering: "Worth Considering",
  proceed_with_caution: "Proceed with Caution",
  not_recommended: "Not Recommended",
  insufficient_evidence: "More Evidence Needed",
};

const verdictColors: Record<Verdict, string> = {
  worth_considering: "text-teal-800",
  proceed_with_caution: "text-amber-800",
  not_recommended: "text-red-800",
  insufficient_evidence: "text-stone-700",
};

const issueLabels = {
  product_defect: "Reported defect",
  delivery: "Delivery",
  subjective_preference: "Personal preference",
  missing_feature: "Missing functionality",
  usability: "Usability",
  other: "Other concern",
};

function ReviewLinks({ ids, reviews }: { ids: string[]; reviews: Review[] }) {
  return <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
    {ids.map(id => <a key={id} href={`#review-${encodeURIComponent(id)}`} onClick={() => {
      const review = document.getElementById(`review-${encodeURIComponent(id)}`);
      if (review instanceof HTMLDetailsElement) review.open = true;
    }} className="text-sm font-medium text-teal-800 underline underline-offset-4">
      Review {reviews.findIndex(review => review.id === id) + 1}
    </a>)}
  </div>;
}

function Findings({ title, findings, reviews, negative = false }: {
  title: string; findings: Finding[] | null; reviews: Review[]; negative?: boolean;
}) {
  return <section aria-label={title}>
    <h3 className={`font-semibold ${negative ? "text-red-800" : "text-teal-800"}`}>{title}</h3>
    {findings?.length ? <ul className="mt-4 space-y-5">
      {findings.map((finding, index) => <li key={index}>
        <p className="text-sm leading-relaxed text-stone-700">{finding.text}</p>
        <ReviewLinks ids={finding.review_ids} reviews={reviews} />
        {finding.evidence.length > 0 && <details className="mt-2 text-xs text-stone-600">
          <summary className="cursor-pointer py-1">Source excerpts</summary>
          <ul className="mt-2 space-y-2">{finding.evidence.map((evidence, quoteIndex) => <li key={quoteIndex}>
            <blockquote className="border-l-2 border-stone-200 pl-3 leading-relaxed">“{evidence.quote}”</blockquote>
            <ReviewLinks ids={[evidence.review_id]} reviews={reviews} />
          </li>)}</ul>
        </details>}
      </li>)}
    </ul> : <p className="mt-3 text-sm text-stone-500">{findings === null ? "Findings unavailable in this saved analysis." : "No supported findings identified in the available reviews."}</p>}
  </section>;
}

function Ratings({ product }: { product: ProductAnalysis["product"] }) {
  return <div className="mt-6 border-t border-stone-200 pt-5">
    <h3 className="text-sm font-semibold">Amazon ratings</h3>
    <p className="mt-2 text-sm text-stone-600">
      {product.overall_rating === null ? "Overall rating unavailable" : <><strong className="text-xl font-semibold text-stone-800">{product.overall_rating.toFixed(1)}</strong> / 5</>}
      {product.rating_count !== null && <> · {product.rating_count.toLocaleString()} ratings</>}
    </p>
    {product.rating_distribution.some(bucket => bucket.percentage !== null) ? <div className="mt-4 space-y-2" aria-label="Amazon rating distribution">
      {[5, 4, 3, 2, 1].map(stars => {
        const percentage = product.rating_distribution.find(bucket => bucket.stars === stars)?.percentage;
        return <div key={stars} className="flex items-center gap-3 text-xs">
          <span className="w-10 shrink-0 text-stone-600">{stars} star</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100" aria-hidden>
            {percentage != null && <div className={`h-full rounded-full ${stars <= 2 ? "bg-amber-600" : "bg-teal-700"}`} style={{ width: `${percentage}%` }} />}
          </div>
          <span className="w-21 shrink-0 text-right tabular-nums text-stone-600">{percentage == null ? "Unavailable" : `${percentage}%`}</span>
        </div>;
      })}
    </div> : <p className="mt-3 text-xs text-stone-500">Rating distribution unavailable.</p>}
  </div>;
}

export function AnalysisResults({ result }: { result: ProductAnalysis }) {
  const hasRefinedFindings = Boolean(result.positive_findings?.length || result.negative_findings?.length || result.recurring_issues?.length) || result.reasons.length === 0;
  const sample = result.sample_statistics;
  return <div className="mt-6 space-y-7">
    <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <a href={result.product.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-3 text-sm font-medium leading-relaxed text-stone-600 hover:text-teal-800">
        {result.product.title || result.product.asin}<ExternalLink size={16} aria-hidden className="mt-1 shrink-0" />
      </a>
      <h3 className={`mt-4 text-3xl font-semibold tracking-tight ${verdictColors[result.verdict]}`}>{verdictLabels[result.verdict]}</h3>
      <p className="mt-3 leading-relaxed text-stone-700">{result.summary}</p>
      <p className="mt-5 text-sm text-stone-600">{result.reviews.length} reviews collected · {result.coverage.reviews_analyzed} analyzed</p>
      {(result.usage || result.cached) && <p className="mt-2 text-xs text-stone-500">
        {result.usage && <>Model · {result.usage.model}</>}
        {result.cached && <>{result.usage ? " · " : ""}Cached · no new AI call</>}
        {!result.cached && result.usage && result.usage.reserved_cost_usd > 0 && <span title="Conservative spending reservation for this request. Actual billing may be lower."> · ${result.usage.reserved_cost_usd.toFixed(4)} reserved</span>}
      </p>}
      <Ratings product={result.product} />
    </div>

    {sample && <p className="text-sm leading-relaxed text-stone-600">
      In the collected sample · {sample.negative_count} reviews at 1–2 stars · {sample.positive_count} at 4–5 stars
      {sample.neutral_count > 0 && <> · {sample.neutral_count} at 3 stars</>}
      {sample.unrated_count > 0 && <> · {sample.unrated_count} without a rating</>}
      {sample.oldest_review_date && sample.newest_review_date && <span className="mt-1 block text-xs text-stone-500">Dated reviews · {sample.oldest_review_date} to {sample.newest_review_date}</span>}
    </p>}

    {hasRefinedFindings && <div className="grid gap-7 border-t border-stone-200 pt-6 sm:grid-cols-2 sm:gap-8">
      <Findings title="Top negative findings" findings={result.negative_findings} reviews={result.reviews} negative />
      <Findings title="Top positive findings" findings={result.positive_findings} reviews={result.reviews} />
    </div>}

    {result.recurring_issues && result.recurring_issues.length > 0 && <section aria-label="Recurring issues" className="border-t border-stone-200 pt-6">
      <h3 className="font-semibold text-red-800">Recurring issues</h3>
      <ul className="mt-4 space-y-5">{result.recurring_issues.map((issue, index) => {
        const critical = ["product_defect", "missing_feature", "usability"].includes(issue.category);
        return <li key={index} className={`border-l-2 pl-4 ${critical ? "border-red-300" : "border-amber-300"}`}>
          <p className={`text-xs font-medium ${critical ? "text-red-800" : "text-amber-900"}`}>{issueLabels[issue.category]} · {issue.mention_count} supporting reviews</p>
          <p className="mt-1 text-sm leading-relaxed text-stone-700">{issue.text}</p>
          <ReviewLinks ids={issue.review_ids} reviews={result.reviews} />
        </li>;
      })}</ul>
    </section>}

    {!hasRefinedFindings && result.reasons.length > 0 && <section aria-label="Reasons behind the verdict" className="border-t border-stone-200 pt-6">
      <h3 className="font-semibold">Reasons behind the verdict</h3>
      <ul className="mt-4 space-y-5">{result.reasons.map((reason, index) => <li key={index}>
        <p className="text-sm leading-relaxed text-stone-700">{reason.text}</p>
        <ReviewLinks ids={reason.review_ids} reviews={result.reviews} />
      </li>)}</ul>
    </section>}

    <section aria-label="Data limitations" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h3 className="font-semibold">Data limitations</h3>
      {result.coverage.limitations.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5">{result.coverage.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul> : <p className="mt-2">No additional limitations were reported by the source.</p>}
      {productMissing(result) && <p className="mt-2">Some Amazon rating information was unavailable.</p>}
    </section>

    {result.reviews.length > 0 && <section aria-label="Supporting reviews" className="border-t border-stone-200 pt-6">
      <h3 className="mb-3 font-semibold">Supporting reviews</h3>
      <div className="space-y-2">{result.reviews.map((review, index) => <details key={review.id} id={`review-${encodeURIComponent(review.id)}`} className="scroll-mt-6 rounded-xl border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium leading-relaxed">Review {index + 1}{review.stars !== null ? ` · ${review.stars}/5 stars` : " · Rating unavailable"}{review.title && <span className="mt-1 block text-stone-700">{review.title}</span>}</summary>
        {review.date && <p className="mt-3 text-xs text-stone-500">{review.date}</p>}
        {review.variant && <p className="mt-2 text-xs text-stone-500">Variant · {review.variant}</p>}
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{review.text}</p>
        <a href={review.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-teal-800 underline underline-offset-4">View source on Amazon</a>
      </details>)}</div>
    </section>}
  </div>;
}

function productMissing(result: ProductAnalysis) {
  return result.product.overall_rating === null || result.product.rating_count === null || result.product.rating_distribution.length < 5 || result.product.rating_distribution.some(bucket => bucket.percentage === null);
}
