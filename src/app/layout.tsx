import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
export const metadata: Metadata = { title: "BuyWise AI — Know Before You Buy", description: "Evidence-based Amazon product review intelligence." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="light" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('buywise-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}` }} /></head><body className={`${sans.variable} ${serif.variable}`}>{children}</body></html>;
}
