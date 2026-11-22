"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Lightbulb, LoaderCircle, Package, Sparkles, Star } from "lucide-react";
import { AnalysisResults } from "@/components/analysis-results";
import { analyzeDemoProduct, demoImageUrl, getDemoCategories, getDemoEvidence, getDemoProducts } from "@/services/demo-api";
import type { DemoCategory, DemoEvidence, DemoProduct } from "@/services/demo-api";
import type { ProductAnalysis } from "@/types/api";

// Browse saved evidence freely. A model request happens only after the Analyze button is pressed.
export function DemoCatalog() {
  const [categories, setCategories] = useState<DemoCategory[]>([]);
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [selected, setSelected] = useState<DemoProduct | null>(null);
  const [evidence, setEvidence] = useState<DemoEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProductAnalysis | null>(null);
  const [workflow, setWorkflow] = useState<"httpx" | "langchain">("httpx");
  const browseRequest = useRef<AbortController | null>(null);
  const analysisRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    browseRequest.current = controller;
    void (async () => {
      try {
        const available = await getDemoCategories(controller.signal);
        const first = available[0];
        const items = first ? await getDemoProducts(first.id, controller.signal) : [];
        if (controller.signal.aborted) return;
        setCategories(available); setCategory(first?.id ?? ""); setProducts(items);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load saved products.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => { controller.abort(); browseRequest.current?.abort(); analysisRequest.current?.abort(); };
  }, []);

  async function chooseCategory(id: string) {
    browseRequest.current?.abort();
    const controller = new AbortController(); browseRequest.current = controller;
    setCategory(id); setProducts([]); setSelected(null); setEvidence(null); setResult(null); setError(""); setLoading(true);
    try {
      const items = await getDemoProducts(id, controller.signal);
      if (!controller.signal.aborted) setProducts(items);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load products.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }

  async function chooseProduct(product: DemoProduct) {
    browseRequest.current?.abort();
    const controller = new AbortController(); browseRequest.current = controller;
    setSelected(product); setResult(null); setEvidence(null); setError("");
    try {
      const saved = await getDemoEvidence(product.id, controller.signal);
      if (!controller.signal.aborted) setEvidence(saved);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load saved evidence.");
    }
  }

  async function analyze() {
    if (!selected || !evidence || analysisRequest.current) return;
    const controller = new AbortController(); analysisRequest.current = controller;
    setAnalyzing(true); setError(""); setResult(null);
    try {
      const report = await analyzeDemoProduct(selected.id, controller.signal, workflow);
      if (!controller.signal.aborted) setResult(report);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Analysis failed. Please try again.");
    } finally { analysisRequest.current = null; if (!controller.signal.aborted) setAnalyzing(false); }
  }

  return <section className="demo-catalog" aria-label="Saved product catalog">
    <div className="demo-categories" role="tablist" aria-label="Product categories">
      {categories.map(c => <button key={c.id} role="tab" aria-selected={category === c.id} disabled={analyzing} onClick={() => void chooseCategory(c.id)}><Lightbulb size={18} aria-hidden />{c.name}<span>{c.product_count}</span></button>)}
    </div>
    {loading && <p role="status" className="demo-status"><LoaderCircle size={18} className="animate-spin" aria-hidden />Loading saved products…</p>}
    {!loading && !categories.length && !error && <p className="demo-status">No saved product datasets are available yet.</p>}
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
    {selected && <div className="demo-analyze-actions">{process.env.NEXT_PUBLIC_DEV_MODE === "true" && <label>Workflow<select value={workflow} disabled={analyzing} onChange={e => { setWorkflow(e.target.value as "httpx" | "langchain"); setResult(null); }}><option value="httpx">HTTPX / GPT-5 nano</option><option value="langchain">LangChain / GPT-5 nano (local Lab)</option></select></label>}
      <button type="button" className="primary-button" disabled={!evidence || analyzing} onClick={() => void analyze()}>{analyzing ? <><LoaderCircle size={16} className="animate-spin" aria-hidden />Analyzing…</> : <><Sparkles size={16} aria-hidden />Analyze Product<ArrowRight size={16} aria-hidden /></>}</button>
    </div>}
    {evidence && <details className="demo-evidence"><summary>View Source Evidence</summary>
      <p>Supplied screenshots · Amazon AI-generated summary/topics · partial excerpts have no verified review IDs, dates or star ratings.</p>
      {evidence.product.customers_say && <><h3>Amazon Customers Say</h3><p>{evidence.product.customers_say}</p></>}
      {evidence.product.feedback_topics.map((topic, i) => <div className="demo-source-topic" key={i}><strong>{topic.name} · {topic.sentiment ?? "Unknown"}{topic.mention_count != null && ` · ${topic.mention_count} mentions`}</strong>{topic.text && <p>{topic.text}</p>}</div>)}
      <ul>{evidence.limitations.map((line, i) => <li key={i}>{line}</li>)}</ul>{evidence.topic_excerpts.map((e, i) => <blockquote key={i}><strong>{e.topic} · {e.partial ? "partial excerpt" : "visible excerpt"}</strong><p>“{e.text}”</p><small>{e.source_file.split("/").at(-1)}</small></blockquote>)}</details>}
    {error && <p role="alert" className="analysis-error">{error}</p>}
    {(analyzing || result) && <section aria-label="Full Analysis" aria-busy={analyzing} className="demo-full-analysis"><h2>Full Analysis</h2>
      <p role="status" className="demo-status">{analyzing ? "Analyzing the saved evidence with GPT-5 nano…" : `${workflow === "httpx" ? "HTTPX" : "LangChain"} / GPT-5 nano · ${result?.cached ? "Cached analysis" : "Analysis ready"}`}</p>
      {result && <AnalysisResults result={result} idPrefix="demo-" hideSourceEvidence />}
    </section>}
  </section>;
}
