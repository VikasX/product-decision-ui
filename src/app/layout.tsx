import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Product Intelligence", description: "AI-powered product review investigation." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
