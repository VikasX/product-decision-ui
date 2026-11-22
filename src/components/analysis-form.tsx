"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Link2, FileSearch, LoaderCircle, Sparkles } from "lucide-react";
import { analyzeProduct } from "@/services/api";
import { AnalysisResults } from "@/components/analysis-results";
import type { ProductAnalysis } from "@/types/api";

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
    <form className="analysis-search" onSubmit={submit}>
      <label className="url-field">
        <Link2 size={20} aria-hidden />
        <span className="sr-only">Amazon product URL</span>
        <input required type="url" value={url} disabled={loading} onChange={event => {
          setUrl(event.target.value);
          setError("");
        }} placeholder="Paste Amazon product URL here..." />
      </label>
      <button disabled={loading} className="primary-button">
        {loading ? <>Analyzing <LoaderCircle size={17} aria-hidden className="animate-spin" /></> : <><Sparkles size={16} aria-hidden className="sparkle" /><span>Analyze Product</span><ArrowRight size={17} aria-hidden /></>}
      </button>
    </form>
    {error && <p role="alert" className="analysis-error">{error}</p>}
    <section className="results-region" aria-label="Analysis results" aria-busy={loading}>
      <p role="status" className={result ? "sr-only" : "empty-state"}>
        {!result && <FileSearch size={25} aria-hidden />}
        {loading ? "Investigating accessible reviews and product details. This may take a moment." : result ? "Analysis ready." : "Paste a product link to see the evidence behind your next purchase."}
      </p>
      {result && <AnalysisResults result={result} />}
    </section>
  </>;
}
