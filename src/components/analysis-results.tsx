import { Check, ChevronDown, Download, ExternalLink, FileText, Minus, Package, ShieldCheck, Star, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { createContext, useContext } from "react";
import type { AmazonFinding, FeedbackTopic, Finding, ProductAnalysis, Review } from "@/types/api";
import { overallPercentages, productDisplayName, ratingOverview, reliabilityTopics, reportText, sampleGroups, shortText, verdictLabels } from "@/services/report";

// Translate fixed API issue categories into readable labels; these do not change the model verdict.
const issueLabels = { product_defect: "Reported defect", delivery: "Delivery", subjective_preference: "Personal preference", missing_feature: "Missing functionality", usability: "Usability", other: "Other concern" };
// Scope review anchors so HTTP and Lab reports can coexist without duplicate IDs.
const ReviewScope = createContext("");

// Open nested review disclosures before following a citation so its evidence becomes visible.
function ReviewLinks({ ids, reviews }: { ids: string[]; reviews: Review[] }) {
  // Read the nearest report prefix through React context so nested citation links target the correct report.
  const prefix = useContext(ReviewScope);
  // Map each source ID to a clickable review link. Clicking also opens its collapsed source panels.
  return <div className="review-links">{ids.map(id => <a key={id} href={`#${prefix}review-${encodeURIComponent(id)}`} onClick={() => {
    // Locate the parent Supporting Reviews disclosure for this report only.
    const group = document.getElementById(`${prefix}supporting-reviews`);
    // Check the element type before using the native details open property.
    if (group instanceof HTMLDetailsElement) group.open = true;
    // Encode the source ID so it matches the ID assigned to the review panel below.
    const review = document.getElementById(`${prefix}review-${encodeURIComponent(id)}`);
    // Open the individual review so following its anchor reveals the supporting text.
    if (review instanceof HTMLDetailsElement) review.open = true;
  }}>Review {reviews.findIndex(review => review.id === id) + 1}</a>)}</div>;
}

// Null means an older saved report lacks this section; an empty list means no supported findings.
function FindingList({ findings, reviews }: { findings: Finding[] | null; reviews: Review[] }) {
  // Show findings when present. Distinguish a missing older section from a genuinely empty finding list.
  return findings?.length ? <ul className="finding-list">{findings.map((finding, index) => <li key={index}>
    {/* Each finding shows its claim and links to the supplied source reviews. */}
    <Check size={16} className="finding-check" aria-hidden /><div><p>{finding.text}</p><ReviewLinks ids={finding.review_ids} reviews={reviews} />
      {/* Quotes stay collapsed until requested; each quote carries its own source link. */}
      <details className="source-excerpts"><summary>Source excerpts</summary>{finding.evidence.map((quote, i) => <blockquote key={i}>“{quote.quote}”<ReviewLinks ids={[quote.review_id]} reviews={reviews} /></blockquote>)}</details>
    </div>
  </li>)}</ul> : <p className="muted empty-finding">{findings === null ? "Unavailable in this saved analysis." : "No directly cited written-review findings in this section."}</p>;
}

// Label secondary Amazon AI evidence separately from directly quoted written reviews.
function AmazonFindings({ findings, compact = false }: { findings: AmazonFinding[]; compact?: boolean }) {
  // Compact cards show a short source-backed preview; the saved finding and its quote remain unchanged.
  if (compact) return findings.length > 0 && <><ul className="finding-list">{findings.map((f, i) => <li key={i}><Check size={16} className="finding-check" aria-hidden /><p>{shortText(f.text)}</p></li>)}</ul></>;
  // Amazon summary/topic findings show their distinct source labels instead of pretending to cite a direct review.
  return findings.length > 0 && <ul className="finding-list amazon-findings">{findings.map((f, i) => <li key={i}><Check size={16} className="finding-check" aria-hidden /><div><p>{f.text}</p><details className="source-excerpts"><summary>Amazon AI {f.source === "topic" ? `topic: ${f.topic}` : "Customers say summary"}</summary><blockquote>“{f.quote}”</blockquote></details></div></li>)}</ul>;
}

// Show saved Amazon topics when model findings are absent. These are secondary evidence, not direct review citations.
export function TopicFeedback({ topics }: { topics: FeedbackTopic[] }) {
  // Prefer the supplied topic description; fall back only to its observed sentiment. Source metadata stays in the report.
  return topics.length > 0 ? <><ul className="finding-list topic-feedback">{topics.map((topic, i) => <li key={i}><Check size={16} className="finding-check" aria-hidden /><div><strong>{topic.name}</strong><p>{shortText(topic.text || `${topic.sentiment ?? "Unknown"} feedback reported by Amazon.`)}</p></div></li>)}</ul></> : <p className="chart-note">No feedback supplied for this section.</p>;
}

// Accept overall histogram shares and render the demo ring. This component does not classify text or call an API.
function RatingSentiment({ percentages }: { percentages: ReturnType<typeof overallPercentages> }) {
  // Keep each overall percentage with its label, color and source star range for a consistent ring and legend.
  const groups = [
    { label: "Positive", range: "4★–5★", value: percentages.positive, tone: "positive" },
    { label: "Neutral", range: "3★", value: percentages.neutral, tone: "neutral" },
    { label: "Negative", range: "1★–2★", value: percentages.negative, tone: "negative" },
  ];
  return <section className="card sentiment-card" aria-label="Overall rating sentiment"><h3>Review Sentiment</h3><div className="sentiment-content"><div className="donut"><svg viewBox="0 0 100 100" aria-hidden><circle className="donut-track" cx="50" cy="50" r="42" fill="none" strokeWidth="10" />{groups.map((group, i) => {
    // Earlier shares determine this arc's start position; unknown shares add no visible segment.
    const start = groups.slice(0, i).reduce((sum, previous) => sum + (previous.value ?? 0), 0);
    // Skip unknown shares. pathLength=100 makes the arc length a percentage; the legend still displays N/A.
    return group.value == null ? null : <circle key={group.tone} className={`donut-segment ${group.tone}`} cx="50" cy="50" r="42" fill="none" strokeWidth="10" pathLength="100" strokeDasharray={`${group.value} ${100 - group.value}`} strokeDashoffset={-start} />;
  })}</svg><div className="donut-center"><strong>{percentages.positive == null ? "N/A" : `${percentages.positive}%`}</strong><span>Positive</span></div></div><ul className="sentiment-legend">{groups.map(group => <li key={group.tone}><span className={`legend-dot ${group.tone}`} /><span>{group.label}<small>{group.range}</small></span><strong>{group.value == null ? "N/A" : `${group.value}%`}</strong></li>)}</ul></div></section>;
}

// Render a decorative SVG on each side of the verdict title; mirror flips the second ornament through CSS.
function Laurel({ mirror = false }: { mirror?: boolean }) {
  return <svg className={`laurel ${mirror ? "mirror" : ""}`} aria-hidden viewBox="0 0 24 24" fill="currentColor"><path d="M11 2C8 6 5 11 6 16c.4 2 1.3 3.6 2.5 4.8-.4-.9-.6-2-.6-3.2 0-3.5 1.7-6.8 3.1-9.6zM4 9c0 2.2.8 4.2 2 5.8C5.4 13.3 5 11.7 5 10c0-1.8.5-3.5 1.4-5C5 6.3 4 7.6 4 9z" /></svg>;
}

// Validated report in; render observed ratings, sampled evidence and verdict without another API call.
export function AnalysisResults({ result, idPrefix = "", hideSourceEvidence = false, demoMode = false }: { result: ProductAnalysis; idPrefix?: string; hideSourceEvidence?: boolean; demoMode?: boolean }) {
  // Use the product evidence from the validated API report; this component does not fetch more data.
  const product = result.product;
  // Demo charts use overall histogram shares; the original non-demo ring still uses collected review counts.
  const percentages = overallPercentages(product.rating_distribution);
  // Build a short rating-based overview separately from the AI verdict; the response object is never rewritten.
  const overview = ratingOverview(product);
  // Group validated secondary-source findings by claim sentiment for the strengths section.
  const positive = result.amazon_findings.filter(f => f.sentiment === "positive");
  // Filter existing supported concerns; no sentiment is inferred from topic mention counts here.
  const negative = result.amazon_findings.filter(f => f.sentiment === "negative");
  // The original report still groups mixed claims separately from explicitly negative findings.
  const reliability = reliabilityTopics(product.feedback_topics);
  // Only put secondary findings in this card when their exact topic concerns dependability.
  const reliabilityFindings = result.amazon_findings.filter(f => f.source === "topic" && reliability.some(topic => topic.name === f.topic));
  const mixed = result.amazon_findings.filter(f => f.sentiment === "mixed");
  // Fallback concerns use up to three saved topics: negative first, then mixed, without inventing review IDs.
  const concernTopics = [...product.feedback_topics.filter(t => t.sentiment === "negative"), ...product.feedback_topics.filter(t => t.sentiment === "mixed")].slice(0, 3);
  // Group collected reviews by their observed stars for the sample ring and legend.
  const groups = sampleGroups(result.reviews);
  // Read the backend-computed counts/date bounds, which may be missing from older saved reports.
  const sample = result.sample_statistics;
  // Detect whether detailed findings exist before deciding to show the older reasons fallback.
  const refined = Boolean(result.positive_findings?.length || result.negative_findings?.length || result.recurring_issues?.length || result.reliability_findings?.length || result.amazon_findings.length);

  // Build a local text download from the current report; exporting never invokes the LLM.
  function exportReport() {
    // Turn the text report into a browser-local Blob URL; nothing is uploaded to a server.
    const url = URL.createObjectURL(new Blob([reportText(result)], { type: "text/plain;charset=utf-8" }));
    // Create a temporary download link without adding another visible control to the page.
    const link = document.createElement("a");
    // Point the link at the local Blob, choose a workflow/product filename, and trigger the download.
    link.href = url; link.download = `BuyWise-${idPrefix}${product.asin}.txt`; link.click();
    // Release the temporary Blob URL after the download has had a chance to start.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Provide the report prefix to every nested review link while rendering the result layout.
  return <ReviewScope.Provider value={idPrefix}><div className={`analysis-results${demoMode ? " demo-report" : ""}`}>
    {/* The first row combines observed product details with the separate validated model verdict. */}
    <div className="product-verdict-row">
      <section className="card product-card" aria-label="Product information">
        {/* Render the image only when a validated source URL exists; failed image loads hide its empty container. */}
        {product.image_url && <div className="product-image">
          {/* Amazon supplies a validated image URL; a standard image avoids a server-side image fetch. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image_url} alt={product.title} referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement!.style.display = "none"; }} />
        </div>}
        {/* Link the title to the real product page; use the ASIN as a display fallback. */}
        <div className="product-copy"><h2><a href={product.url} target="_blank" rel="noopener noreferrer">{productDisplayName(product.title) || product.asin}<ExternalLink size={14} aria-label="Opens Amazon" /></a></h2>
          {/* Keep the marketplace label and product ID visible so users know which listing was analyzed. */}
          <div className="product-meta"><span className="amazon-badge"><b>a</b> Amazon.in</span><span>ASIN · {product.asin}</span></div>
          {/* Show the numeric average and count only when known; filled star icons are a rounded visual aid. */}
          <div className="product-rating"><strong>{product.overall_rating?.toFixed(1) ?? "Rating unavailable"}</strong>{product.overall_rating != null && <span className="stars" aria-label={`${product.overall_rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map(star => <Star key={star} size={16} aria-hidden fill={star <= Math.round(product.overall_rating!) ? "currentColor" : "none"} />)}</span>}{product.rating_count != null && <span className="muted">({product.rating_count.toLocaleString("en-IN")} ratings)</span>}</div>
          {/* Collected and AI-analyzed counts differ when input limits or failed analysis prevent using the whole sample. */}
          {!demoMode && <div className="sample-badges"><span className="sample-badge"><Check size={13} aria-hidden />{result.coverage.reviews_analyzed} reviews analyzed</span><span className="muted">{result.reviews.length} collected</span></div>}
          {/* Only display an observed price and make clear it may change after collection. */}
          {product.price_text && <p className="product-price">{product.price_text}<span className="muted">Observed on Amazon · may change</span></p>}
          {/* Map the observed label/value list into a definition list; omit the section when no specs arrived. */}
          {product.specifications.length > 0 && <dl className="product-specs">{product.specifications.map((spec, index) => <div key={index}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>}
          {/* Explain cache reuse to the user; viewing this report did not start another AI request. */}
          {!demoMode && result.cached && <p className="cache-label">Cached analysis · no new AI call</p>}
    {/* Show available Amazon AI summary/topics with explicit source labels; topic counts are not failure rates. */}
    {!hideSourceEvidence && (product.customers_say || product.feedback_topics.length > 0) && <section className="amazon-summary" aria-label="Amazon customer summary"><h3>Customers say <span>Amazon AI-generated summary</span></h3>{product.customers_say && <p>{product.customers_say}</p>}<div className="feedback-topics">{product.feedback_topics.map((topic, i) => <div key={i} className={`feedback-topic topic-${topic.sentiment ?? "unknown"}`}><strong>{topic.name}</strong><span>{topic.sentiment ?? "Sentiment unavailable"}{topic.mention_count != null && ` · ${topic.mention_count} mentions`}</span>{(topic.positive_count != null || topic.negative_count != null) && <span>{topic.positive_count != null ? `${topic.positive_count} positive` : ""}{topic.positive_count != null && topic.negative_count != null ? " · " : ""}{topic.negative_count != null ? `${topic.negative_count} negative` : ""}</span>}{topic.text && <p>{topic.text}</p>}</div>)}</div><p className="chart-note">Amazon’s summary and topics are secondary evidence. Mention counts are not failure rates.</p></section>}
        </div>
      </section>
      {/* Demo Mode shows a short rating overview; original workflows retain their validated AI verdict and explanation. */}
      <section className={`verdict-card verdict-${result.verdict}`} aria-label={demoMode ? "Rating overview" : "Final verdict"}><div className="verdict-badge"><Check size={15} aria-hidden />{demoMode ? "Amazon overall ratings" : "Final Verdict"}</div><div className="verdict-title"><Laurel /><h2>{demoMode ? overview.title : verdictLabels[result.verdict]}</h2><Laurel mirror /></div><p>{demoMode ? overview.summary : result.summary}</p><span className="verdict-accent" /></section>
    </div>

    {/* These three panels deliberately separate overall Amazon ratings from the small written-review sample. */}
    <div className="three-column-grid analytics-row">
      {/* Render stars from five down to one, using only the corresponding observed histogram percentages. */}
      <section className="card rating-card" aria-label="Amazon rating distribution"><h3>Rating Distribution {product.rating_count != null && <span>({product.rating_count.toLocaleString("en-IN")})</span>}</h3><div className="rating-bars">{[5, 4, 3, 2, 1].map(stars => {
        // Find this exact star bucket; an absent percentage remains unknown.
        const percentage = product.rating_distribution.find(b => b.stars === stars)?.percentage;
        // Use zero only for the empty visual width; keep the label N/A when the underlying percentage is missing.
        return <div className="rating-bar-row" key={stars}><span>{stars} ★</span><div className="bar-track" aria-hidden><div className={`bar-fill star-${stars}`} style={{ width: `${percentage ?? 0}%` }} /></div><span className="bar-value">{percentage == null ? "N/A" : `${percentage}%`}</span></div>;
      })}</div>{!demoMode && <p className="chart-note">Amazon overall ratings. N/A means unavailable.</p>}</section>
      {/* Demo Mode uses overall rating percentages; other workflows retain the written-review sample ring. */}
      {demoMode ? <RatingSentiment percentages={percentages} /> : <section className="card sentiment-card" aria-label="Written review sample"><h3>Review Sentiment <span>({result.reviews.length} collected)</span></h3><div className="sentiment-content"><div className="donut"><svg viewBox="0 0 100 100" aria-hidden><circle className="donut-track" cx="50" cy="50" r="42" fill="none" strokeWidth="10" />{groups.map(group => {
        // Convert this group count to a share of the collected sample, guarding against division by zero.
        const percentage = result.reviews.length ? group.count / result.reviews.length * 100 : 0;
        // Sum preceding group counts to determine where this segment begins around the ring.
        const start = result.reviews.length ? groups.slice(0, groups.indexOf(group)).reduce((sum, previous) => sum + previous.count, 0) / result.reviews.length * 100 : 0;
        // pathLength=100 lets percentages define arc length; a negative offset places this arc after earlier ones.
        return <circle key={group.tone} className={`donut-segment ${group.tone}`} cx="50" cy="50" r="42" fill="none" strokeWidth="10" pathLength="100" strokeDasharray={`${percentage} ${100 - percentage}`} strokeDashoffset={-start} />;
      })}</svg><div className="donut-center"><strong>{result.reviews.length}</strong><span>Reviews</span></div></div><ul className="sentiment-legend">{groups.filter(g => g.tone !== "unrated" || g.count > 0).map(group => <li key={group.tone}><span className={`legend-dot ${group.tone}`} /><span>{group.label}<small>{group.range}</small></span><strong>{group.count}</strong></li>)}</ul></div><p className="chart-note">Accessible product-page reviews. Not overall satisfaction. {result.coverage.reviews_analyzed} AI analyzed.</p></section>}
      {/* Use the shared overall-rating calculation for these tiles, never the ring sample proportions. */}
      <section className="card percentage-card" aria-label="Overall Amazon rating percentages"><h3>Key Percentages {!demoMode && <span>(Amazon overall ratings)</span>}</h3><div className="percentage-grid">{[
        { name: "Positive", tone: "positive", value: percentages.positive, Icon: ThumbsUp },
        { name: "Neutral", tone: "neutral", value: percentages.neutral, Icon: Minus },
        { name: "Negative", tone: "negative", value: percentages.negative, Icon: ThumbsDown },
      ].map(({ name, tone, value, Icon }) => <div className="percentage-tile" key={name}><span className={`percentage-icon ${tone}`}><Icon size={17} aria-hidden /></span><strong>{value == null ? "N/A" : `${value}%`}</strong><span>{name}</span></div>)}</div>{!demoMode && <p className="chart-note">4–5★ / 3★ / 1–2★ · unavailable buckets stay N/A.</p>}</section>
    </div>


    {/* Place findings into strengths, concerns and reliability without mixing their source types. */}
    <div className="three-column-grid insights-row">
      {/* Show supported direct-review strengths and positive Amazon AI findings together with distinct source labels. */}
      <section className="card insight-card positive-insights"><h3><ThumbsUp size={19} aria-hidden />What Buyers Like</h3>{(!demoMode || Boolean(result.positive_findings?.length)) && <FindingList findings={result.positive_findings} reviews={result.reviews} />}{demoMode && !positive.length ? <TopicFeedback topics={product.feedback_topics.filter(t => t.sentiment === "positive").slice(0, 2)} /> : <AmazonFindings findings={positive} compact={demoMode} />}</section>
      {/* Show supported direct-review concerns and negative Amazon AI findings, not guessed complaint rates. */}
      <section className="card insight-card concern-insights"><h3><TriangleAlert size={19} aria-hidden />Common Concerns</h3>{(!demoMode || Boolean(result.negative_findings?.length)) && <FindingList findings={result.negative_findings} reviews={result.reviews} />}{demoMode && !negative.length ? <TopicFeedback topics={concernTopics} /> : <AmazonFindings findings={negative} compact={demoMode} />}</section>
      {/* Demo reliability uses relevant supplied topic evidence, without interpreting unrelated mixed feedback as reliability. */}
      <section className="card insight-card reliability-insights"><h3><ShieldCheck size={19} aria-hidden />Reliability Insights</h3>{(!demoMode || Boolean(result.reliability_findings?.length)) && <FindingList findings={result.reliability_findings} reviews={result.reviews} />}{demoMode ? (reliabilityFindings.length ? <AmazonFindings findings={reliabilityFindings} compact /> : <TopicFeedback topics={reliability} />) : <AmazonFindings findings={mixed} />}
        {/* Render recurring concerns only when the validated API supplied them, including actual distinct citation counts. */}
        {!demoMode && result.recurring_issues && result.recurring_issues.length > 0 && <div className="recurring-issues">{result.recurring_issues.map((issue, index) => <div key={index}><p className="issue-label">{issueLabels[issue.category]} · {issue.mention_count} cited reviews</p><p>{issue.text}</p><ReviewLinks ids={issue.review_ids} reviews={result.reviews} /></div>)}</div>}
        {/* Omit this block for older or incomplete reports that have no practical takeaway. */}
        {!demoMode && result.key_takeaway && <div className="key-takeaway"><h4>Key Takeaway</h4><p>{result.key_takeaway}</p></div>}
      </section>
    </div>

    {/* Support older reports by rendering their reasons only when detailed finding sections are absent. */}
    {!demoMode && !refined && result.reasons.length > 0 && <section className="card legacy-reasons"><h3>Reasons Behind the Verdict</h3>{result.reasons.map((reason, i) => <div key={i}><p>{reason.text}</p><ReviewLinks ids={reason.review_ids} reviews={result.reviews} /></div>)}</section>}

    {/* Source/export controls remain available in original workflows but stay hidden in the compact demo. */}
    {!demoMode && <><div className="footer-actions"><section className="card evidence-limitations" aria-label="Evidence limitations"><h3><FileText size={20} aria-hidden />Evidence Limitations</h3><div>{result.coverage.limitations.length ? <ul>{result.coverage.limitations.map((line, i) => <li key={i}>{line}</li>)}</ul> : <p>No additional limitations were reported.</p>}{sample?.oldest_review_date && sample.newest_review_date && <p className="sample-date">Dated sample · {sample.oldest_review_date} to {sample.newest_review_date}</p>}</div></section><div className="report-actions"><a className="primary-button" href={`#${idPrefix}supporting-reviews`} onClick={() => { const el = document.getElementById(`${idPrefix}supporting-reviews`); if (el instanceof HTMLDetailsElement) el.open = true; }}><FileText size={17} aria-hidden />Supporting Reviews ({result.reviews.length})<span aria-hidden>→</span></a><button type="button" className="secondary-button" onClick={exportReport}><Download size={17} aria-hidden />Export Report</button></div></div>

    {/* Each review gets a prefixed stable anchor, its observed metadata and original text; empty collection stays explicit. */}
    <details id={`${idPrefix}supporting-reviews`} className="card supporting-reviews"><summary><span><FileText size={19} aria-hidden />Supporting Reviews <span className="muted">({result.reviews.length})</span></span><ChevronDown size={18} aria-hidden /></summary><p className="chart-note">Accessible source text; other variants may be included. Review ratings do not guarantee the body is positive or negative.</p>{result.reviews.length ? <div className="review-list">{result.reviews.map((review, index) => <details className="review-detail" key={review.id} id={`${idPrefix}review-${encodeURIComponent(review.id)}`}><summary><span>Review {index + 1} · {review.stars != null ? `${review.stars}/5 stars` : "Rating unavailable"}{review.title && <b>{review.title}</b>}</span><ChevronDown size={16} aria-hidden /></summary><div className="review-body">{review.date && <p className="muted">{review.date}</p>}{review.variant && <p className="muted"><Package size={13} aria-hidden />Variant · {review.variant}</p>}<p className="review-text">{review.text}</p><a href={review.source_url} target="_blank" rel="noopener noreferrer">View source on Amazon <ExternalLink size={13} aria-hidden /></a></div></details>)}</div> : <p className="empty-finding muted">No written reviews were accessible.</p>}</details>
    </>}
  </div></ReviewScope.Provider>;
}
