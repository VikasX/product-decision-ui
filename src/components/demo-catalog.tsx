// This interactive component uses browser state, effects and click handlers, so Next.js runs it on the client.
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Headphones, Lightbulb, LoaderCircle, Package, Sparkles, Star } from "lucide-react";
import { AnalysisResults } from "@/components/analysis-results";
import { analyzeDemoProduct, demoImageUrl, getDemoCategories, getDemoEvidence, getDemoProducts } from "@/services/demo-api";
import type { DemoCategory, DemoEvidence, DemoProduct } from "@/services/demo-api";
import type { ProductAnalysis } from "@/types/api";

// Browse saved evidence freely. A model request happens only after the Analyze button is pressed.
export function DemoCatalog() {
  // Available category tabs come from the backend manifest, not a hardcoded demo list.
  const [categories, setCategories] = useState<DemoCategory[]>([]);
  // Store the active category ID so the selected tab and its product cards stay in sync.
  const [category, setCategory] = useState("");
  // Keep only the card records belonging to the currently selected category.
  const [products, setProducts] = useState<DemoProduct[]>([]);
  // null means no product has been clicked yet; selecting a card does not start a paid analysis.
  const [selected, setSelected] = useState<DemoProduct | null>(null);
  // Loading the saved dataset successfully enables Analyze; the raw evidence stays hidden on the homepage.
  const [evidence, setEvidence] = useState<DemoEvidence | null>(null);
  // This loading flag covers catalog reads, independently of the longer AI analysis state.
  const [loading, setLoading] = useState(true);
  // Disable selection while analysis runs so a returned report cannot appear under a different product.
  const [analyzing, setAnalyzing] = useState(false);
  // An empty string hides the error message; failures store a readable message for the alert below.
  const [error, setError] = useState("");
  // Hold one validated report, or null before analysis and whenever the selection changes.
  const [result, setResult] = useState<ProductAnalysis | null>(null);
  // HTTPX is the default adapter. The developer-only selector can request the separate local LangChain path.
  const [workflow, setWorkflow] = useState<"httpx" | "langchain">("httpx");
  // Refs survive renders without causing another render; keep cancellation handles for in-flight work.
  const browseRequest = useRef<AbortController | null>(null);
  // This immediate request handle also blocks rapid duplicate Analyze clicks before React updates its state.
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
    setCategory(id); setProducts([]); setSelected(null); setEvidence(null); setResult(null); setError(""); setLoading(true);
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

  // Input: a clicked card. Load its full saved JSON and return no report until Analyze is explicitly pressed.
  async function chooseProduct(product: DemoProduct) {
    // Cancel the old catalog/evidence read before starting work for the new selection.
    browseRequest.current?.abort();
    // AbortController lets cleanup cancel fetches and prevents old responses from updating the current screen.
    // Give this read its own cancellation signal and remember it as the current browsing request.
    const controller = new AbortController(); browseRequest.current = controller;
    // Show the selection immediately while clearing old evidence/results and waiting for the new dataset.
    setSelected(product); setResult(null); setEvidence(null); setError("");
    try {
      // This GET reads saved JSON only; choosing a product cannot spend OpenAI credit.
      const saved = await getDemoEvidence(product.id, controller.signal);
      // Accept evidence only for a selection that is still active, then enable the Analyze button.
      if (!controller.signal.aborted) setEvidence(saved);
    // Fetch or validation failures become an alert; aborted work must not overwrite the latest screen.
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load saved evidence.");
    }
  }

  // Explicit paid-work boundary: submit the chosen product ID and adapter, then store the validated report.
  async function analyze() {
    // Require loaded evidence and reject duplicate submissions before making any analysis request.
    if (!selected || !evidence || analysisRequest.current) return;
    // AbortController lets cleanup cancel fetches and prevents old responses from updating the current screen.
    // Store the handle synchronously so another click cannot create a second request during this render.
    const controller = new AbortController(); analysisRequest.current = controller;
    // Replace any previous report with a loading state instead of displaying it as this run's result.
    setAnalyzing(true); setError(""); setResult(null);
    try {
      // The backend checks cache first; only an uncached, budget-approved request can invoke GPT-5 nano.
      const report = await analyzeDemoProduct(selected.id, controller.signal, workflow);
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
      {categories.map(c => <button key={c.id} role="tab" aria-selected={category === c.id} disabled={analyzing} onClick={() => void chooseCategory(c.id)}><span className="category-icon">{c.id === "headphone" ? <Headphones size={18} aria-hidden /> : <Lightbulb size={18} aria-hidden />}</span>{c.name}<span>{c.product_count}</span></button>)}
    </div>
    {category && <div className="demo-section-heading"><h2>{category === "headphone" ? <Headphones size={20} aria-hidden /> : <Lightbulb size={20} aria-hidden />}{categories.find(item => item.id === category)?.name}</h2><span>Select a product to explore</span></div>}
    <div className="demo-selection">
    {/* Catalog loading and an empty catalog have separate messages, so a pending request is not mistaken for no data. */}
    {loading && <p role="status" className="demo-status"><LoaderCircle size={18} className="animate-spin" aria-hidden />Loading saved products…</p>}
    {!loading && !categories.length && !error && <p className="demo-status">No saved product datasets are available yet.</p>}
    {/* Create cards only for saved backend records. A click selects/loads evidence and does not invoke the model. */}
    {products.length > 0 && <>
      <div className="demo-products">{products.map(product => <button type="button" key={product.id} className={`demo-product card ${selected?.id === product.id ? "is-selected" : ""}`} aria-pressed={selected?.id === product.id} disabled={analyzing} onClick={() => void chooseProduct(product)}>
        <span className="demo-data-badge">{selected?.id === product.id ? <><Check size={12} aria-hidden />Selected</> : "Saved data"}</span>
        <span className="demo-product-image">{product.image_path ? <>
          {/* Display only the product-image region of the original supplied screenshot via CSS. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={demoImageUrl(product.image_path)} alt={product.title} />
        </> : <Package size={52} aria-hidden />}</span>
        <strong>{product.title}</strong><span className="demo-rating"><Star size={14} fill="currentColor" aria-hidden />{product.overall_rating ?? "Rating unavailable"}{product.rating_count !== null && <small>({product.rating_count.toLocaleString("en-IN")} ratings)</small>}</span>
        {product.price_text && <b className="demo-price">{product.price_text}</b>}
      </button>)}</div>
    </>}
    {/* The developer flag controls selector visibility only; the backend separately restricts LangChain access. */}
    {selected && <div className="demo-analyze-actions">{process.env.NEXT_PUBLIC_DEV_MODE === "true" && <label>Workflow<select value={workflow} disabled={analyzing} onChange={e => { setWorkflow(e.target.value as "httpx" | "langchain"); setResult(null); }}><option value="httpx">HTTPX / GPT-5 nano</option><option value="langchain">LangChain / GPT-5 nano (local Lab)</option></select></label>}
      {/* Require loaded evidence and prevent duplicate clicks; this is the only button that submits analysis. */}
      <button type="button" className="primary-button" disabled={!evidence || analyzing} onClick={() => void analyze()}>{analyzing ? <><LoaderCircle size={16} className="animate-spin" aria-hidden />Analyzing…</> : <><Sparkles size={16} aria-hidden />Analyze Product<ArrowRight size={16} aria-hidden /></>}</button>
    </div>}
    </div>
    {/* Display the safe API/validation message without treating it as a product verdict. */}
    {error && <p role="alert" className="analysis-error">{error}</p>}
    {/* Show one shared dashboard only after Analyze; choosing a different product clears the previous result. */}
    {(analyzing || result) && <section aria-label="Full Analysis" aria-busy={analyzing} className="demo-full-analysis"><h2>Full Analysis</h2>
      <p role="status" className="demo-status">{analyzing ? "Analyzing the saved evidence with GPT-5 nano…" : `${workflow === "httpx" ? "HTTPX" : "LangChain"} / GPT-5 nano · ${result?.cached ? "Cached analysis" : "Analysis ready"}`}</p>
      {/* Reuse the existing report with a demo anchor prefix and compact presentation; do not duplicate its cards. */}
      {result && <AnalysisResults result={result} idPrefix="demo-" hideSourceEvidence demoMode />}
    </section>}
  </section>;
}
