"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FlaskConical, Link2, LoaderCircle } from "lucide-react";
import { AnalysisResults } from "@/components/analysis-results";
import { analyzeWithLangChain } from "@/services/langchain-api";
import type { ProductAnalysis } from "@/types/api";

export function LangChainLab() {
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
      if (productUrl.protocol !== "https:" || !["amazon.in", "www.amazon.in"].includes(productUrl.hostname)) throw new Error("Invalid URL");
    } catch {
      setError("Paste a full Amazon.in product link starting with https://.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setResult(null);
    try {
      setResult(await analyzeWithLangChain(productUrl.href, controller.signal));
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof TypeError
        ? "Could not reach the LangChain service. Check the backend and try again."
        : cause instanceof Error ? cause.message : "LangChain analysis failed.");
    } finally {
      request.current = null;
      setLoading(false);
    }
  }

  return <details className="card langchain-lab">
    <summary><span><FlaskConical size={19} aria-hidden />LangChain Lab</span><ChevronDown size={18} aria-hidden /></summary>
    <div className="lab-content">
      <p className="lab-workflow">Experimental workflow · LangChain / GPT-5 nano</p>
      <p className="chart-note">Independent analysis using the same review collection and shared spending limits. Requires an enabled local backend.</p>
      <form className="analysis-search" onSubmit={submit}>
        <label className="url-field"><Link2 size={20} aria-hidden /><span className="sr-only">LangChain Amazon product URL</span><input required type="url" value={url} disabled={loading} onChange={event => { setUrl(event.target.value); setError(""); }} placeholder="Paste Amazon product URL here..." /></label>
        <button className="primary-button" disabled={loading}>{loading ? <><LoaderCircle size={16} className="animate-spin" aria-hidden />Analyzing with LangChain</> : "Analyze with LangChain"}</button>
      </form>
      {error && <p role="alert" className="analysis-error">{error}</p>}
      <section aria-label="LangChain analysis results" aria-busy={loading}>
        <p role="status" className={result ? "sr-only" : "chart-note"}>{loading ? "Investigating accessible reviews with LangChain…" : result ? "LangChain analysis ready." : "No LangChain analysis requested yet."}</p>
        {result && <AnalysisResults result={result} idPrefix="langchain-" />}
      </section>
    </div>
  </details>;
}
