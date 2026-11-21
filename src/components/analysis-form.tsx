"use client";
import { useState } from "react";
import { ArrowRight, Link2, FileSearch } from "lucide-react";

export function AnalysisForm() {
  const [submitted, setSubmitted] = useState(false);
  return <>
    <form className="mt-9 flex flex-col gap-3 sm:flex-row" onSubmit={event => {
      event.preventDefault();
      setSubmitted(true);
    }}>
      <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-stone-300 bg-white px-4 focus-within:ring-2 focus-within:ring-teal-700">
        <Link2 size={18} aria-hidden className="shrink-0 text-stone-500" />
        <span className="sr-only">Amazon product URL</span>
        <input type="url" onChange={() => setSubmitted(false)} placeholder="Paste an Amazon product URL..." className="h-14 w-full min-w-0 bg-transparent outline-none" />
      </label>
      <button className="flex h-14 items-center justify-center gap-3 rounded-xl bg-teal-800 px-6 font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-4">
        Analyze Product <ArrowRight size={17} aria-hidden />
      </button>
    </form>
    <section className="mt-16 border-t border-stone-300 pt-7" aria-labelledby="results">
      <h2 id="results" className="flex items-center gap-2 text-lg font-semibold"><FileSearch size={20} aria-hidden className="text-teal-800" />Analysis results</h2>
      <p role="status" className="mt-2 text-stone-600">{submitted ? "Analysis coming soon" : "Your product analysis will appear here."}</p>
    </section>
  </>;
}
