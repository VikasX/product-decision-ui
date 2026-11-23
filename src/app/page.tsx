import { ShoppingBag, Sparkles } from "lucide-react";
import Link from "next/link";
import { DemoCatalog } from "@/components/demo-catalog";
import { ThemeToggle } from "@/components/theme-toggle";

// The public experience browses saved evidence; original URL adapters remain available internally.
export default function Home() {
  return <>
    {/* Compose the shared brand and theme control above the main form. */}
    <header className="site-header">
      <div className="header-inner">
        <div className="brand-group"><Link href="/" className="brand" aria-label="BuyWise AI home"><span className="brand-icon"><ShoppingBag size={21} aria-hidden /></span><span>BuyWise <b>AI</b></span></Link><span className="brand-caption">AI Product Review Analyzer</span></div>
        <div className="header-actions"><span className="smart-badge"><Sparkles size={15} aria-hidden /> Demo Mode</span><ThemeToggle /></div>
      </div>
    </header>
    <main className="main-content">
      <div className="hero"><h1>Know Before <em>You Buy</em></h1>
      <p>Choose a product. Explore the evidence. Make a more confident buying decision.</p></div>
      {/* The client catalog owns category/product selection, saved-evidence loading and the explicit analysis action. */}
      <DemoCatalog />
      {/* Model adapters stay in private backend tooling; public builds have no generation controls. */}
    </main>
  </>;
}
