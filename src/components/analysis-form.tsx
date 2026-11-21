"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Link2, FileSearch, LoaderCircle, ExternalLink } from "lucide-react";
import { analyzeProduct } from "@/services/api";
import type { ProductAnalysis } from "@/types/api";

const verdictLabels = {
  buy: "Buy",
  skip: "Skip",
  insufficient_evidence: "More evidence needed",
};

export function AnalysisForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProductAnalysis | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    setError("");
    let productUrl: URL;
    try {
      productUrl = new URL(url.trim());
      if (!["amazon.in", "www.amazon.in"].includes(productUrl.hostname) || productUrl.protocol !== "https:") {
        throw new Error("Invalid URL");
      }
    } catch {
      setError("Paste a full Amazon.in product link starting with https://.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setResult(null);
    try {
      setResult(await analyzeProduct(productUrl.href, controller.signal));
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof TypeError
          ? "Could not reach the analysis service. Check that the backend is running and try again."
          : cause instanceof Error ? cause.message : "Analysis failed. Please try again.");
      }
    } finally {
      request.current = null;
      setLoading(false);
    }
  }

  return <>
    <form className="mt-9 flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
      <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-stone-300 bg-white px-4 focus-within:ring-2 focus-within:ring-teal-700">
        <Link2 size={18} aria-hidden className="shrink-0 text-stone-500" />
        <span className="sr-only">Amazon product URL</span>
        <input required type="url" value={url} disabled={loading} onChange={event => {
          setUrl(event.target.value);
          setError("");
        }} placeholder="Paste an Amazon.in product URL..." className="h-14 w-full min-w-0 bg-transparent outline-none disabled:opacity-60" />
      </label>
      <button disabled={loading} className="flex h-14 items-center justify-center gap-3 rounded-xl bg-teal-800 px-6 font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-70">
        {loading ? <>Analyzing <LoaderCircle size={17} aria-hidden className="animate-spin" /></> : <>Analyze Product <ArrowRight size={17} aria-hidden /></>}
      </button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <section className="mt-16 border-t border-stone-300 pt-7" aria-labelledby="results" aria-busy={loading}>
      <h2 id="results" className="flex items-center gap-2 text-lg font-semibold"><FileSearch size={20} aria-hidden className="text-teal-800" />Analysis results</h2>
      <p role="status" className="mt-2 text-sm text-stone-600">
        {loading ? "Checking available product details and reviews. This may take a moment." : result ? "Analysis ready." : "Your product analysis will appear here."}
      </p>
      {result && <div className="mt-6 space-y-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <a href={result.product.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-3 text-sm font-medium text-stone-600 hover:text-teal-800">
            {result.product.title || result.product.asin}<ExternalLink size={16} aria-hidden className="mt-0.5 shrink-0" />
          </a>
          <h3 className={`mt-4 text-3xl font-semibold tracking-tight ${result.verdict === "skip" ? "text-red-800" : result.verdict === "buy" ? "text-teal-800" : "text-amber-800"}`}>{verdictLabels[result.verdict]}</h3>
          <p className="mt-3 leading-relaxed text-stone-700">{result.summary}</p>
          <p className="mt-5 text-sm text-stone-500">{result.reviews.length} reviews collected · {result.coverage.reviews_analyzed} analyzed</p>
          {(result.usage || result.cached) && <p className="mt-2 text-xs text-stone-500">
            {result.usage && <>Model · {result.usage.model}</>}
            {result.cached && <>{result.usage ? " · " : ""}Cached · no new AI call</>}
            {!result.cached && result.usage && result.usage.reserved_cost_usd > 0 && <span title="Conservative spending reservation for this request. Actual billing may be lower."> · ${result.usage.reserved_cost_usd.toFixed(4)} reserved</span>}
          </p>}
        </div>
        {result.coverage.limitations.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <h3 className="font-semibold">Evidence limitations</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">{result.coverage.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>
        </div>}
        {result.reasons.length > 0 && <div>
          <h3 className="font-semibold">Reasons behind the verdict</h3>
          <ul className="mt-3 space-y-3">{result.reasons.map((reason, index) => <li key={index} className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="leading-relaxed">{reason.text}</p>
            <div className="mt-2 flex flex-wrap gap-3">{reason.review_ids.filter(id => result.reviews.some(review => review.id === id)).map(id => <a key={id} href={`#review-${encodeURIComponent(id)}`} onClick={() => {
              const review = document.getElementById(`review-${encodeURIComponent(id)}`);
              if (review instanceof HTMLDetailsElement) review.open = true;
            }} className="text-sm font-medium text-teal-800 underline underline-offset-4">Review {result.reviews.findIndex(review => review.id === id) + 1}</a>)}</div>
          </li>)}</ul>
        </div>}
        {result.reviews.length > 0 && <div>
          <h3 className="mb-3 font-semibold">Supporting reviews</h3>
          <div className="space-y-2">{result.reviews.map((review, index) => <details key={review.id} id={`review-${encodeURIComponent(review.id)}`} className="scroll-mt-6 rounded-xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium">Review {index + 1}{review.stars !== null ? ` · ${review.stars}/5 stars` : ""}{review.date ? ` · ${review.date}` : ""}</summary>
            {review.variant && <p className="mt-3 text-xs text-stone-500">Variant · {review.variant}</p>}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{review.text}</p>
            {review.source_url && <a href={review.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-teal-800 underline underline-offset-4">View source on Amazon</a>}
          </details>)}</div>
        </div>}
      </div>}
    </section>
  </>;
}
