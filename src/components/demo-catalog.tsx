// This interactive component uses browser state, effects and click handlers, so Next.js runs it on the client.
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Headphones, Laptop, Lightbulb, LoaderCircle, Package, Smartphone, Sparkles, Star, Tv } from "lucide-react";
import { AnalysisResults, TopicFeedback } from "@/components/analysis-results";
import { getDemoAnalysis, demoImageUrl, getDemoCategories, getDemoEvidence, getDemoProducts } from "@/services/demo-api";
import type { DemoCategory, DemoEvidence, DemoProduct } from "@/services/demo-api";
import type { ProductAnalysis } from "@/types/api";
import { productDisplayName, reliabilityTopics } from "@/services/report";

// A category's icon is presentation only; unknown future categories get a generic product icon.
function CategoryIcon({ id, size }: { id: string; size: number }) {
  const icons = { led: Lightbulb, headphone: Headphones, mobile: Smartphone, laptop: Laptop, tv: Tv };
  const Icon = icons[id as keyof typeof icons] ?? Package;
  return <Icon size={size} aria-hidden />;
}

// Clip a filled five-star row to the actual average, so 3.4 is not rounded up to four stars.
function RatingStars({ rating }: { rating: number }) {
  return <span className="demo-stars" aria-hidden>
    <span>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} />)}</span>
    <span className="demo-stars-fill" style={{ width: `${Math.max(0, Math.min(5, rating)) * 20}%` }}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill="currentColor" />)}</span>
  </span>;
}

// Browse ready products and read their permanent reports. This component never requests model generation.
export function DemoCatalog() {
  // Available category tabs come from the backend manifest, not a hardcoded demo list.
  const [categories, setCategories] = useState<DemoCategory[]>([]);
  // Store the active category ID so the selected tab and its product cards stay in sync.
  const [category, setCategory] = useState("");
  // Keep only the card records belonging to the currently selected category.
  const [products, setProducts] = useState<DemoProduct[]>([]);
  // null means no product has been clicked yet; selecting a card does not start a paid analysis.
  const [selected, setSelected] = useState<DemoProduct | null>(null);
  // Load saved evidence before enabling View Analysis; raw evidence stays hidden on the homepage.
  const [evidence, setEvidence] = useState<DemoEvidence | null>(null);
  // This loading flag covers catalog reads, independently of the longer AI analysis state.
  const [loading, setLoading] = useState(true);
  // Disable selection while analysis runs so a returned report cannot appear under a different product.
  const [analyzing, setAnalyzing] = useState(false);
  // An empty string hides the error message; failures store a readable message for the alert below.
  const [error, setError] = useState("");
  // Hold one validated report, or null before analysis and whenever the selection changes.
  const [result, setResult] = useState<ProductAnalysis | null>(null);
  // Product details use the real saved evidence when a private AI report has not been published yet.
  // Keep this separate from result so source text is never presented as a generated AI report.
  const [showDetails, setShowDetails] = useState(false);
  // Refs survive renders without causing another render; keep cancellation handles for in-flight work.
  const browseRequest = useRef<AbortController | null>(null);
  // Block duplicate report reads immediately, before React updates the loading state.
  const analysisRequest = useRef<AbortController | null>(null);

  // Run once after mounting: load category tabs, then the first category. No model is called by this effect.
  useEffect(() => {
    // AbortController lets cleanup cancel fetches and prevents old responses from updating the current screen.
    const controller = new AbortController();
    // Keep the initial request handle available if the user switches category before loading finishes.
    browseRequest.current = controller;
    // Start an async task inside the effect; void discards its promise because the effect must return cleanup.
    void (async () => {
      try {
        // await pauses this task until the API returns a validated list of saved categories.
        const available = await getDemoCategories(controller.signal);
        // Follow manifest order when choosing the initial tab; an empty catalog has no first item.
        const first = available[0];
        // Fetch cards only when a real category exists; the empty-list fallback avoids a request with no ID.
        const items = first ? await getDemoProducts(first.id, controller.signal) : [];
        // A newer selection or unmount makes this response stale, so leave current state untouched.
        if (controller.signal.aborted) return;
        // These setters schedule a render with matching tabs, active ID and cards.
        setCategories(available); setCategory(first?.id ?? ""); setProducts(items);
      // Report real failures, but suppress cancellation errors from cleanup or a newer selection.
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load saved products.");
      // finally runs after success or failure; only the active request may clear its loading indicator.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    // React calls cleanup on unmount (and during development checks); cancel outstanding browser requests.
    return () => { controller.abort(); browseRequest.current?.abort(); analysisRequest.current?.abort(); };
  }, []);

  // Input: the clicked category ID. Load its cards and clear the previous product/report to prevent stale results.
  async function chooseCategory(id: string) {
    // Cancel the old catalog/evidence read before starting work for the new selection.
    browseRequest.current?.abort();
    // AbortController lets cleanup cancel fetches and prevents old responses from updating the current screen.
    // Give this read its own cancellation signal and remember it as the current browsing request.
    const controller = new AbortController(); browseRequest.current = controller;
    // Reset dependent state together: a different category invalidates its former selected product and report.
    setCategory(id); setProducts([]); setSelected(null); setEvidence(null); setResult(null); setShowDetails(false); setError(""); setLoading(true);
    try {
      // Only small card records are fetched here; full evidence waits until a product is clicked.
      const items = await getDemoProducts(id, controller.signal);
      if (!controller.signal.aborted) setProducts(items);
    // Fetch or validation failures become an alert; aborted work must not overwrite the latest screen.
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load products.");
    // Always stop this request's spinner when it finishes, unless a newer request has replaced it.
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }

  // Input: a clicked card. Load saved evidence; show the report only after View Analysis is pressed.
  async function chooseProduct(product: DemoProduct) {
    // Cancel the old catalog/evidence read before starting work for the new selection.
    browseRequest.current?.abort();
    // AbortController lets cleanup cancel fetches and prevents old responses from updating the current screen.
    // Give this read its own cancellation signal and remember it as the current browsing request.
    const controller = new AbortController(); browseRequest.current = controller;
    // Show the selection immediately while clearing old evidence/results and waiting for the new dataset.
    setSelected(product); setResult(null); setShowDetails(false); setEvidence(null); setError("");
    try {
      // This GET reads saved JSON only; choosing a product cannot spend OpenAI credit.
      const saved = await getDemoEvidence(product.id, controller.signal);
      // Accept evidence only for the current selection, then enable View Analysis.
      if (!controller.signal.aborted) setEvidence(saved);
    // Fetch or validation failures become an alert; aborted work must not overwrite the latest screen.
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load saved evidence.");
    }
  }

  // Read the selected product's existing report; no adapter or generation option is sent by the browser.
  async function analyze() {
    // Require loaded evidence and reject duplicate submissions before making any analysis request.
    if (!selected || !evidence || analysisRequest.current) return;
    // Every product stays useful. Missing reports show existing source details, never an error or a paid fallback.
    if (!selected.analysis_ready) { setShowDetails(true); setResult(null); return; }
    setShowDetails(false);
    // AbortController lets cleanup cancel fetches and prevents old responses from updating the current screen.
    // Store the handle synchronously so another click cannot create a second request during this render.
    const controller = new AbortController(); analysisRequest.current = controller;
    // Replace any previous report with a loading state instead of displaying it as this run's result.
    setAnalyzing(true); setError(""); setResult(null);
    try {
      // The public GET endpoint reads analysis.json only, independently of MongoDB/OpenAI availability.
      const report = await getDemoAnalysis(selected.id, controller.signal);
      // A successful response has already passed frontend parsing; React now renders the shared dashboard.
      if (!controller.signal.aborted) setResult(report);
    // Fetch or validation failures become an alert; aborted work must not overwrite the latest screen.
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Analysis failed. Please try again.");
    // Release the duplicate-click guard after success or failure; do not set state after cancellation.
    } finally { analysisRequest.current = null; if (!controller.signal.aborted) setAnalyzing(false); }
  }

  // Render only catalog data supplied by the backend, preserving the existing theme classes and report components.
  return <section className="demo-catalog" aria-label="Saved product catalog">
    {/* Map real category records to tabs; disable switching during analysis to keep the report tied to its selection. */}
    <div className="demo-categories" role="tablist" aria-label="Product categories">
      {categories.map(c => <button key={c.id} role="tab" aria-selected={category === c.id} disabled={analyzing} onClick={() => void chooseCategory(c.id)}><span className="category-icon"><CategoryIcon id={c.id} size={20} /></span>{c.name}</button>)}
    </div>
    {category && <div className="demo-section-heading"><h2><CategoryIcon id={category} size={20} />{categories.find(item => item.id === category)?.name}</h2></div>}
    <div className="demo-selection">
    {/* Catalog loading and an empty catalog have separate messages, so a pending request is not mistaken for no data. */}
    {loading && <p role="status" className="demo-status"><LoaderCircle size={18} className="animate-spin" aria-hidden />Loading saved products…</p>}
    {!loading && !categories.length && !error && <p className="demo-status">No saved product datasets are available yet.</p>}
    {/* Create cards only for saved backend records. A click selects/loads evidence and does not invoke the model. */}
    {products.length > 0 && <>
      <div className="demo-products">{products.map(product => <button type="button" key={product.id} className={`demo-product card ${selected?.id === product.id ? "is-selected" : ""}`} aria-pressed={selected?.id === product.id} disabled={analyzing} onClick={() => void chooseProduct(product)}>
        {/* Only the active card needs a badge; the others stay visually quiet. */}
        {selected?.id === product.id && <span className="demo-data-badge"><Check size={12} aria-hidden />Selected</span>}
        <span className="demo-product-image">{product.image_path ? <>
          {/* Display the local product photo; the card no longer depends on a full source screenshot. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${demoImageUrl(product.image_path)}?v=${product.version}`} alt={productDisplayName(product.title)} />
        </> : <Package size={52} aria-hidden />}</span>
        <strong title={product.title}>{productDisplayName(product.title)}</strong><span className="demo-rating">{product.overall_rating !== null && <RatingStars rating={product.overall_rating} />}<span className="demo-rating-value">{product.overall_rating ?? "Rating unavailable"}</span>{product.rating_count !== null && <small>({product.rating_count.toLocaleString("en-IN")} ratings)</small>}</span>
        {product.price_text && <b className="demo-price">{product.price_text}</b>}
      </button>)}</div>
    </>}
    {/* Both model workflows remain in private backend tooling; the public action only reads a saved report. */}
    {selected && <div className="demo-selection-bar"><strong>{productDisplayName(selected.title)}</strong><div className="demo-analyze-actions">
      {/* Require loaded evidence and prevent duplicate report reads. This never submits paid work. */}
      <button type="button" className="primary-button" disabled={!evidence || analyzing} onClick={() => void analyze()}>{analyzing ? <><LoaderCircle size={16} className="animate-spin" aria-hidden />Loading…</> : <><Sparkles size={16} aria-hidden />{selected.analysis_ready ? "View Analysis" : "View Details"}<ArrowRight size={16} aria-hidden /></>}</button>
    </div></div>}
    </div>
    {/* Display the safe API/validation message without treating it as a product verdict. */}
    {error && <p role="alert" className="analysis-error">{error}</p>}
    {/* Reuse the existing topic cards, but name this source-only view accurately and create no AI verdict. */}
    {showDetails && evidence && <section className="demo-full-analysis demo-report" aria-label="Product Details"><h2>Product Details</h2>
      {evidence.product.customers_say && <section className="card insight-card"><h3>Customer Feedback</h3><p>{evidence.product.customers_say}</p></section>}
      <div className="three-column-grid insights-row">
        {evidence.product.feedback_topics.some(t => t.sentiment === "positive") && <section className="card insight-card"><h3>What Buyers Like</h3><TopicFeedback topics={evidence.product.feedback_topics.filter(t => t.sentiment === "positive").slice(0, 3)} /></section>}
        {evidence.product.feedback_topics.some(t => t.sentiment === "negative" || t.sentiment === "mixed") && <section className="card insight-card"><h3>Common Concerns</h3><TopicFeedback topics={[...evidence.product.feedback_topics.filter(t => t.sentiment === "negative"), ...evidence.product.feedback_topics.filter(t => t.sentiment === "mixed")].slice(0, 3)} /></section>}
        {reliabilityTopics(evidence.product.feedback_topics).length > 0 && <section className="card insight-card"><h3>Reliability Insights</h3><TopicFeedback topics={reliabilityTopics(evidence.product.feedback_topics)} /></section>}
      </div>
    </section>}
    {/* Show one shared dashboard after View Analysis; changing product clears the previous report. */}
    {(analyzing || result) && <section aria-label="Full Analysis" aria-busy={analyzing} className="demo-full-analysis"><h2>Full Analysis</h2>
      {/* Show progress only while working; adapter/cache details remain in the API response, not the dashboard. */}
      {analyzing && <p role="status" className="demo-status">Loading analysis…</p>}
      {/* Reuse the existing report with a demo anchor prefix and compact presentation; do not duplicate its cards. */}
      {result && <AnalysisResults result={result} idPrefix="demo-" hideSourceEvidence demoMode />}
    </section>}
  </section>;
}
