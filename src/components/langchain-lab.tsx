// This component handles browser events and React state, so it belongs on the client side.
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FlaskConical, Link2, LoaderCircle } from "lucide-react";
import { AnalysisResults } from "@/components/analysis-results";
import { analyzeWithLangChain } from "@/services/langchain-api";
import type { ProductAnalysis } from "@/types/api";

// Independent form state keeps experimental requests/results separate from the HTTP form.
export function LangChainLab() {
  // url stores the current input; setUrl updates it and asks React to render again.
  const [url, setUrl] = useState("");
  // Track whether this form has a pending request so its controls and loading message stay in sync.
  const [loading, setLoading] = useState(false);
  // Store a readable validation/network/server error; an empty string means there is no error to display.
  const [error, setError] = useState("");
  // Keep the validated report, or null before a successful response. This state belongs only to this form.
  const [result, setResult] = useState<ProductAnalysis | null>(null);
  // Prevent duplicate submissions before React finishes rendering the loading state.
  const request = useRef<AbortController | null>(null);
  // Abort pending browser work when this section unmounts.
  useEffect(() => () => request.current?.abort(), []);

  // Same URL contract as the main form, but dispatch to the dedicated LangChain endpoint.
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    // Stop the browser normal form submission, which would reload the page and lose React state.
    event.preventDefault();
    // A request ref changes immediately, so a rapid second click cannot launch duplicate work.
    if (request.current) return;
    // Clear the previous error when the user submits or changes the URL.
    setError("");
    // Keep a parsed URL object so the code can check the host/protocol rather than guessing from text.
    let productUrl: URL;
    try {
      // Trim spaces and parse the link; malformed URLs throw and are handled by the catch below.
      productUrl = new URL(url.trim());
      // Allow HTTPS Amazon India links only; the server independently validates the product path.
      if (productUrl.protocol !== "https:" || !["amazon.in", "www.amazon.in"].includes(productUrl.hostname)) throw new Error("Invalid URL");
    } catch {
      // Show a useful input message rather than sending an invalid link to the backend.
      setError("Paste a full Amazon.in product link starting with https://.");
      return;
    }
    // Create a cancellation handle for this browser fetch and store it in the ref until completion.
    const controller = new AbortController();
    // Remember the active request synchronously to prevent another submission.
    request.current = controller;
    // Render the pending state and disable submission before starting the HTTP request.
    setLoading(true);
    // Remove the previous product report so it cannot be mistaken for the current request result.
    setResult(null);
    try {
      // Wait for the endpoint and runtime parser, then store the validated report for rendering.
      setResult(await analyzeWithLangChain(productUrl.href, controller.signal));
    // Both HTTP failures and invalid response data reach this error-handling block.
    } catch (cause) {
      // Do not show a new error after this browser request was intentionally cancelled.
      if (!controller.signal.aborted) setError(cause instanceof TypeError
        ? "Could not reach the LangChain service. Check the backend and try again."
        : cause instanceof Error ? cause.message : "LangChain analysis failed.");
    // Always unlock the form and stop loading, whether the request succeeded or failed.
    } finally {
      // Release the immediate submission lock so a later user action can start a new request.
      request.current = null;
      // Ask React to restore normal controls and hide the pending indicator.
      setLoading(false);
    }
  }

  // A native details element supplies the collapsible Lab without extra open/closed React state.
  return <details className="card langchain-lab">
    <summary><span><FlaskConical size={19} aria-hidden />LangChain Lab</span><ChevronDown size={18} aria-hidden /></summary>
    <div className="lab-content">
      {/* Make the experimental adapter/model visible so its result is not confused with the main workflow. */}
      <p className="lab-workflow">Experimental workflow · LangChain / GPT-5 nano</p>
      <p className="chart-note">Independent analysis using the same review collection and shared spending limits. Requires an enabled local backend.</p>
      {/* This second form has its own URL, request lock, loading state and report. */}
      <form className="analysis-search" onSubmit={submit}>
        <label className="url-field"><Link2 size={20} aria-hidden /><span className="sr-only">LangChain Amazon product URL</span><input required type="url" value={url} disabled={loading} onChange={event => { setUrl(event.target.value); setError(""); }} placeholder="Paste Amazon product URL here..." /></label>
        <button className="primary-button" disabled={loading}>{loading ? <><LoaderCircle size={16} className="animate-spin" aria-hidden />Analyzing with LangChain</> : "Analyze with LangChain"}</button>
      </form>
      {/* Display only the Lab request error; this does not overwrite the main form error. */}
      {error && <p role="alert" className="analysis-error">{error}</p>}
      {/* Give the experimental result its own accessible region and loading announcement. */}
      <section aria-label="LangChain analysis results" aria-busy={loading}>
        <p role="status" className={result ? "sr-only" : "chart-note"}>{loading ? "Investigating accessible reviews with LangChain…" : result ? "LangChain analysis ready." : "No LangChain analysis requested yet."}</p>
        {/* The prefix gives this report unique review anchors even when the main report is also visible. */}
        {result && <AnalysisResults result={result} idPrefix="langchain-" />}
      </section>
    </div>
  </details>;
}
