"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Link2, FileSearch, LoaderCircle } from "lucide-react";
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
      {result && <AnalysisResults result={result} />}
    </section>
  </>;
}
