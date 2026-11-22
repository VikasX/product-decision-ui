import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

// Configure the bundled interface font and expose its family through a CSS variable.
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
// Use a second font variable for the approved heading style.
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
// Next.js uses this static metadata for the browser title and description.
export const metadata: Metadata = { title: "BuyWise AI — Know Before You Buy", description: "Evidence-based Amazon product review intelligence." };

// Restore the saved theme before paint to avoid flashing the wrong palette during hydration.
// suppressHydrationWarning allows the root theme attribute to differ after the pre-paint storage script.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // children is the page content supplied by Next.js. The early script restores a valid saved theme.
  return <html lang="en" data-theme="light" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('buywise-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}` }} /></head><body className={`${sans.variable} ${serif.variable}`}>{children}</body></html>;
}
