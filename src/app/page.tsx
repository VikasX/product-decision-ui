import { ShoppingBag, Sparkles } from "lucide-react";
import Link from "next/link";
import { AnalysisForm } from "@/components/analysis-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangChainLab } from "@/components/langchain-lab";

// Server-rendered page composes the normal HTTP form and optional, independent local Lab.
export default function Home() {
  return <>
    {/* Compose the shared brand and theme control above the main form. */}
    <header className="site-header">
      <div className="header-inner">
        <div className="brand-group"><Link href="/" className="brand" aria-label="BuyWise AI home"><span className="brand-icon"><ShoppingBag size={21} aria-hidden /></span><span>BuyWise <b>AI</b></span></Link><span className="brand-caption">AI Product Review Analyzer</span></div>
        <div className="header-actions"><span className="smart-badge"><Sparkles size={15} aria-hidden /> Make Smarter Buying Decisions</span><ThemeToggle /></div>
      </div>
    </header>
    <main className="main-content">
      <div className="hero"><h1>Know Before <em>You Buy</em></h1>
      <p>Analyze Amazon product reviews with AI to get a clear, evidence-based verdict.</p></div>
      {/* The original form owns the normal HTTP request and report state. */}
      <AnalysisForm />
      {/* Build-time visibility only; the backend separately restricts access to the Lab endpoint. */}
      {process.env.NEXT_PUBLIC_DEV_MODE === "true" && <LangChainLab />}
    </main>
  </>;
}
