import { Check, ChevronDown, Download, ExternalLink, FileText, Minus, Package, ShieldCheck, Star, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { createContext, useContext } from "react";
import type { AmazonFinding, Finding, ProductAnalysis, Review } from "@/types/api";
import { overallPercentages, reportText, sampleGroups, verdictLabels } from "@/services/report";

const issueLabels = { product_defect: "Reported defect", delivery: "Delivery", subjective_preference: "Personal preference", missing_feature: "Missing functionality", usability: "Usability", other: "Other concern" };
const ReviewScope = createContext("");

function ReviewLinks({ ids, reviews }: { ids: string[]; reviews: Review[] }) {
  const prefix = useContext(ReviewScope);
  return <div className="review-links">{ids.map(id => <a key={id} href={`#${prefix}review-${encodeURIComponent(id)}`} onClick={() => {
    const group = document.getElementById(`${prefix}supporting-reviews`);
    if (group instanceof HTMLDetailsElement) group.open = true;
    const review = document.getElementById(`${prefix}review-${encodeURIComponent(id)}`);
    if (review instanceof HTMLDetailsElement) review.open = true;
  }}>Review {reviews.findIndex(review => review.id === id) + 1}</a>)}</div>;
}

function FindingList({ findings, reviews }: { findings: Finding[] | null; reviews: Review[] }) {
  return findings?.length ? <ul className="finding-list">{findings.map((finding, index) => <li key={index}>
    <Check size={16} className="finding-check" aria-hidden /><div><p>{finding.text}</p><ReviewLinks ids={finding.review_ids} reviews={reviews} />
      <details className="source-excerpts"><summary>Source excerpts</summary>{finding.evidence.map((quote, i) => <blockquote key={i}>“{quote.quote}”<ReviewLinks ids={[quote.review_id]} reviews={reviews} /></blockquote>)}</details>
    </div>
  </li>)}</ul> : <p className="muted empty-finding">{findings === null ? "Unavailable in this saved analysis." : "No directly cited written-review findings in this section."}</p>;
}

function AmazonFindings({ findings }: { findings: AmazonFinding[] }) {
  return findings.length > 0 && <ul className="finding-list amazon-findings">{findings.map((f, i) => <li key={i}><Check size={16} className="finding-check" aria-hidden /><div><p>{f.text}</p><details className="source-excerpts"><summary>Amazon AI {f.source === "topic" ? `topic: ${f.topic}` : "Customers say summary"}</summary><blockquote>“{f.quote}”</blockquote></details></div></li>)}</ul>;
}

function Laurel({ mirror = false }: { mirror?: boolean }) {
  return <svg className={`laurel ${mirror ? "mirror" : ""}`} aria-hidden viewBox="0 0 24 24" fill="currentColor"><path d="M11 2C8 6 5 11 6 16c.4 2 1.3 3.6 2.5 4.8-.4-.9-.6-2-.6-3.2 0-3.5 1.7-6.8 3.1-9.6zM4 9c0 2.2.8 4.2 2 5.8C5.4 13.3 5 11.7 5 10c0-1.8.5-3.5 1.4-5C5 6.3 4 7.6 4 9z" /></svg>;
}

export function AnalysisResults({ result, idPrefix = "" }: { result: ProductAnalysis; idPrefix?: string }) {
  const product = result.product;
  const percentages = overallPercentages(product.rating_distribution);
  const groups = sampleGroups(result.reviews);
  const sample = result.sample_statistics;
  const refined = Boolean(result.positive_findings?.length || result.negative_findings?.length || result.recurring_issues?.length || result.reliability_findings?.length || result.amazon_findings.length);

  function exportReport() {
    const url = URL.createObjectURL(new Blob([reportText(result)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `BuyWise-${idPrefix}${product.asin}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <ReviewScope.Provider value={idPrefix}><div className="analysis-results">
    <div className="product-verdict-row">
      <section className="card product-card" aria-label="Product information">
        {product.image_url && <div className="product-image">
          {/* Amazon supplies a validated image URL; a standard image avoids a server-side image fetch. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image_url} alt={product.title} referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement!.style.display = "none"; }} />
        </div>}
        <div className="product-copy"><h2><a href={product.url} target="_blank" rel="noopener noreferrer">{product.title || product.asin}<ExternalLink size={14} aria-label="Opens Amazon" /></a></h2>
          <div className="product-meta"><span className="amazon-badge"><b>a</b> Amazon.in</span><span>ASIN · {product.asin}</span></div>
          <div className="product-rating"><strong>{product.overall_rating?.toFixed(1) ?? "Rating unavailable"}</strong>{product.overall_rating != null && <span className="stars" aria-label={`${product.overall_rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map(star => <Star key={star} size={16} aria-hidden fill={star <= Math.round(product.overall_rating!) ? "currentColor" : "none"} />)}</span>}{product.rating_count != null && <span className="muted">({product.rating_count.toLocaleString("en-IN")} ratings)</span>}</div>
          <div className="sample-badges"><span className="sample-badge"><Check size={13} aria-hidden />{result.coverage.reviews_analyzed} reviews analyzed</span><span className="muted">{result.reviews.length} collected</span></div>
          {product.price_text && <p className="product-price">{product.price_text}<span className="muted">Observed on Amazon · may change</span></p>}
          {product.specifications.length > 0 && <dl className="product-specs">{product.specifications.map((spec, index) => <div key={index}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>}
          {result.cached && <p className="cache-label">Cached analysis · no new AI call</p>}
    {(product.customers_say || product.feedback_topics.length > 0) && <section className="amazon-summary" aria-label="Amazon customer summary"><h3>Customers say <span>Amazon AI-generated summary</span></h3>{product.customers_say && <p>{product.customers_say}</p>}<div className="feedback-topics">{product.feedback_topics.map((topic, i) => <div key={i} className={`feedback-topic topic-${topic.sentiment ?? "unknown"}`}><strong>{topic.name}</strong><span>{topic.sentiment ?? "Sentiment unavailable"}{topic.mention_count != null && ` · ${topic.mention_count} mentions`}</span>{(topic.positive_count != null || topic.negative_count != null) && <span>{topic.positive_count != null ? `${topic.positive_count} positive` : ""}{topic.positive_count != null && topic.negative_count != null ? " · " : ""}{topic.negative_count != null ? `${topic.negative_count} negative` : ""}</span>}{topic.text && <p>{topic.text}</p>}</div>)}</div><p className="chart-note">Amazon’s summary and topics are secondary evidence. Mention counts are not failure rates.</p></section>}
        </div>
      </section>
      <section className={`verdict-card verdict-${result.verdict}`} aria-label="Final verdict"><div className="verdict-badge"><Check size={15} aria-hidden />Final Verdict</div><div className="verdict-title"><Laurel /><h2>{verdictLabels[result.verdict]}</h2><Laurel mirror /></div><p>{result.summary}</p><span className="verdict-accent" /></section>
    </div>

    <div className="three-column-grid analytics-row">
      <section className="card rating-card" aria-label="Amazon rating distribution"><h3>Rating Distribution {product.rating_count != null && <span>({product.rating_count.toLocaleString("en-IN")})</span>}</h3><div className="rating-bars">{[5, 4, 3, 2, 1].map(stars => {
        const percentage = product.rating_distribution.find(b => b.stars === stars)?.percentage;
        return <div className="rating-bar-row" key={stars}><span>{stars} ★</span><div className="bar-track" aria-hidden><div className={`bar-fill star-${stars}`} style={{ width: `${percentage ?? 0}%` }} /></div><span className="bar-value">{percentage == null ? "N/A" : `${percentage}%`}</span></div>;
      })}</div><p className="chart-note">Amazon overall ratings. N/A means unavailable.</p></section>
      <section className="card sentiment-card" aria-label="Written review sample"><h3>Review Sentiment <span>({result.reviews.length} collected)</span></h3><div className="sentiment-content"><div className="donut"><svg viewBox="0 0 100 100" aria-hidden><circle className="donut-track" cx="50" cy="50" r="42" fill="none" strokeWidth="10" />{groups.map(group => {
        const percentage = result.reviews.length ? group.count / result.reviews.length * 100 : 0;
        const start = result.reviews.length ? groups.slice(0, groups.indexOf(group)).reduce((sum, previous) => sum + previous.count, 0) / result.reviews.length * 100 : 0;
        return <circle key={group.tone} className={`donut-segment ${group.tone}`} cx="50" cy="50" r="42" fill="none" strokeWidth="10" pathLength="100" strokeDasharray={`${percentage} ${100 - percentage}`} strokeDashoffset={-start} />;
      })}</svg><div className="donut-center"><strong>{result.reviews.length}</strong><span>Reviews</span></div></div><ul className="sentiment-legend">{groups.filter(g => g.tone !== "unrated" || g.count > 0).map(group => <li key={group.tone}><span className={`legend-dot ${group.tone}`} /><span>{group.label}<small>{group.range}</small></span><strong>{group.count}</strong></li>)}</ul></div><p className="chart-note">Accessible product-page reviews. Not overall satisfaction. {result.coverage.reviews_analyzed} AI analyzed.</p></section>
      <section className="card percentage-card" aria-label="Overall Amazon rating percentages"><h3>Key Percentages <span>(Amazon overall ratings)</span></h3><div className="percentage-grid">{[
        { name: "Positive", tone: "positive", value: percentages.positive, Icon: ThumbsUp },
        { name: "Neutral", tone: "neutral", value: percentages.neutral, Icon: Minus },
        { name: "Negative", tone: "negative", value: percentages.negative, Icon: ThumbsDown },
      ].map(({ name, tone, value, Icon }) => <div className="percentage-tile" key={name}><span className={`percentage-icon ${tone}`}><Icon size={17} aria-hidden /></span><strong>{value == null ? "N/A" : `${value}%`}</strong><span>{name}</span></div>)}</div><p className="chart-note">4–5★ / 3★ / 1–2★ · unavailable buckets stay N/A.</p></section>
    </div>


    <div className="three-column-grid insights-row">
      <section className="card insight-card positive-insights"><h3><ThumbsUp size={19} aria-hidden />What Buyers Like</h3><FindingList findings={result.positive_findings} reviews={result.reviews} /><AmazonFindings findings={result.amazon_findings.filter(f => f.sentiment === "positive")} /></section>
      <section className="card insight-card concern-insights"><h3><TriangleAlert size={19} aria-hidden />Common Concerns</h3><FindingList findings={result.negative_findings} reviews={result.reviews} /><AmazonFindings findings={result.amazon_findings.filter(f => f.sentiment === "negative")} /></section>
      <section className="card insight-card reliability-insights"><h3><ShieldCheck size={19} aria-hidden />Reliability Insights</h3><FindingList findings={result.reliability_findings} reviews={result.reviews} /><AmazonFindings findings={result.amazon_findings.filter(f => f.sentiment === "mixed")} />
        {result.recurring_issues && result.recurring_issues.length > 0 && <div className="recurring-issues">{result.recurring_issues.map((issue, index) => <div key={index}><p className="issue-label">{issueLabels[issue.category]} · {issue.mention_count} cited reviews</p><p>{issue.text}</p><ReviewLinks ids={issue.review_ids} reviews={result.reviews} /></div>)}</div>}
        {result.key_takeaway && <div className="key-takeaway"><h4>Key Takeaway</h4><p>{result.key_takeaway}</p></div>}
      </section>
    </div>

    {!refined && result.reasons.length > 0 && <section className="card legacy-reasons"><h3>Reasons Behind the Verdict</h3>{result.reasons.map((reason, i) => <div key={i}><p>{reason.text}</p><ReviewLinks ids={reason.review_ids} reviews={result.reviews} /></div>)}</section>}

    <div className="footer-actions"><section className="card evidence-limitations" aria-label="Evidence limitations"><h3><FileText size={20} aria-hidden />Evidence Limitations</h3><div>{result.coverage.limitations.length ? <ul>{result.coverage.limitations.map((line, i) => <li key={i}>{line}</li>)}</ul> : <p>No additional limitations were reported.</p>}{sample?.oldest_review_date && sample.newest_review_date && <p className="sample-date">Dated sample · {sample.oldest_review_date} to {sample.newest_review_date}</p>}</div></section><div className="report-actions"><a className="primary-button" href={`#${idPrefix}supporting-reviews`} onClick={() => { const el = document.getElementById(`${idPrefix}supporting-reviews`); if (el instanceof HTMLDetailsElement) el.open = true; }}><FileText size={17} aria-hidden />Supporting Reviews ({result.reviews.length})<span aria-hidden>→</span></a><button type="button" className="secondary-button" onClick={exportReport}><Download size={17} aria-hidden />Export Report</button></div></div>

    <details id={`${idPrefix}supporting-reviews`} className="card supporting-reviews"><summary><span><FileText size={19} aria-hidden />Supporting Reviews <span className="muted">({result.reviews.length})</span></span><ChevronDown size={18} aria-hidden /></summary><p className="chart-note">Accessible source text; other variants may be included. Review ratings do not guarantee the body is positive or negative.</p>{result.reviews.length ? <div className="review-list">{result.reviews.map((review, index) => <details className="review-detail" key={review.id} id={`${idPrefix}review-${encodeURIComponent(review.id)}`}><summary><span>Review {index + 1} · {review.stars != null ? `${review.stars}/5 stars` : "Rating unavailable"}{review.title && <b>{review.title}</b>}</span><ChevronDown size={16} aria-hidden /></summary><div className="review-body">{review.date && <p className="muted">{review.date}</p>}{review.variant && <p className="muted"><Package size={13} aria-hidden />Variant · {review.variant}</p>}<p className="review-text">{review.text}</p><a href={review.source_url} target="_blank" rel="noopener noreferrer">View source on Amazon <ExternalLink size={13} aria-hidden /></a></div></details>)}</div> : <p className="empty-finding muted">No written reviews were accessible.</p>}</details>
  </div></ReviewScope.Provider>;
}
