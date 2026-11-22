// This component handles browser events and React state, so it belongs on the client side.
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Link2, FileSearch, LoaderCircle, Sparkles } from "lucide-react";
import { analyzeProduct } from "@/services/api";
import { AnalysisResults } from "@/components/analysis-results";
import type { ProductAnalysis } from "@/types/api";

// Own URL/loading/error/report state for the original HTTP workflow; display only validated results.
export function AnalysisForm() {
  // url stores the current input; setUrl updates it and asks React to render again.
  const [url, setUrl] = useState("");
  // Track whether this form has a pending request so its controls and loading message stay in sync.
  const [loading, setLoading] = useState(false);
  // Store a readable validation/network/server error; an empty string means there is no error to display.
  const [error, setError] = useState("");
  // Keep the validated report, or null before a successful response. This state belongs only to this form.
  const [result, setResult] = useState<ProductAnalysis | null>(null);
  // A ref locks submissions immediately without waiting for a React state update.
  const request = useRef<AbortController | null>(null);

  // Cancel browser-side work on unmount; cancellation cannot refund an already-started model call.
  useEffect(() => () => request.current?.abort(), []);

  // Validate input, POST to FastAPI, then replace the report or show a user-facing failure.
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
      // Allow HTTPS Amazon India links only; backend validation performs its own stricter product-path checks.
      if (!["amazon.in", "www.amazon.in"].includes(productUrl.hostname) || productUrl.protocol !== "https:") {
        throw new Error("Invalid URL");
      }
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
    // Clear the previous report so it cannot be mistaken for the newly submitted product.
    // Remove the previous product report so it cannot be mistaken for the current request result.
    setResult(null);
    try {
      // Wait for the endpoint and runtime parser, then store the validated report for rendering.
      setResult(await analyzeProduct(productUrl.href, controller.signal));
    // Both HTTP failures and invalid response data reach this error-handling block.
    } catch (cause) {
      // Do not show a new error after this browser request was intentionally cancelled.
      if (!controller.signal.aborted) {
        setError(cause instanceof TypeError
          ? "Could not reach the analysis service. Check that the backend is running and try again."
          : cause instanceof Error ? cause.message : "Analysis failed. Please try again.");
      }
    // Always unlock the form and stop loading, whether the request succeeded or failed.
    } finally {
      // Release the immediate submission lock so a later user action can start a new request.
      request.current = null;
      // Ask React to restore normal controls and hide the pending indicator.
      setLoading(false);
    }
  }

  return <>
    {/* Submitting this form invokes submit above; it does not navigate away from the page. */}
    <form className="analysis-search" onSubmit={submit}>
      <label className="url-field">
        <Link2 size={20} aria-hidden />
        <span className="sr-only">Amazon product URL</span>
        {/* This controlled input always displays url state; editing it updates that state and clears old errors. */}
        <input required type="url" value={url} disabled={loading} onChange={event => {
          setUrl(event.target.value);
          // Clear the previous error when the user submits or changes the URL.
          setError("");
        }} placeholder="Paste Amazon product URL here..." />
      </label>
      {/* Disable repeat clicks and switch the label/icon while a request is pending. */}
      <button disabled={loading} className="primary-button">
        {loading ? <>Analyzing <LoaderCircle size={17} aria-hidden className="animate-spin" /></> : <><Sparkles size={16} aria-hidden className="sparkle" /><span>Analyze Product</span><ArrowRight size={17} aria-hidden /></>}
      </button>
    </form>
    {/* Render the alert only for a nonempty error; role=alert lets assistive technology announce it. */}
    {error && <p role="alert" className="analysis-error">{error}</p>}
    {/* Expose pending state through aria-busy while keeping status text separate from report content. */}
    <section className="results-region" aria-label="Analysis results" aria-busy={loading}>
      {/* Show the initial/loading message; after success keep a short screen-reader announcement. */}
      <p role="status" className={result ? "sr-only" : "empty-state"}>
        {!result && <FileSearch size={25} aria-hidden />}
        {loading ? "Investigating accessible reviews and product details. This may take a moment." : result ? "Analysis ready." : "Paste a product link to see the evidence behind your next purchase."}
      </p>
      {/* Only pass a validated non-null report to AnalysisResults. No placeholder product is presented as real data. */}
      {result && <AnalysisResults result={result} />}
    </section>
  </>;
}
