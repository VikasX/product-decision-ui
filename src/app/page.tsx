import { ScanSearch } from "lucide-react";
import { ApiStatus } from "@/components/api-status";
import { AnalysisForm } from "@/components/analysis-form";

export default function Home() {
  return <>
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex min-h-18 max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2.5 font-semibold tracking-tight"><ScanSearch aria-hidden className="size-8 rounded-lg bg-teal-800 p-1.5 text-white" />Product Intelligence</div>
        <ApiStatus />
      </div>
    </header>
    <main className="mx-auto max-w-3xl px-5 pt-20 pb-16 sm:px-8 sm:pt-32">
      <h1 className="text-5xl leading-tight font-semibold tracking-[-0.055em] sm:text-7xl">Know Before You Buy</h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">Investigate Amazon product reviews with AI to understand what buyers are saying before you decide.</p>
      <AnalysisForm />
    </main>
  </>;
}
