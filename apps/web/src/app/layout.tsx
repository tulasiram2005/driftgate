import type { Metadata } from "next";
import { Hanken_Grotesk, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const ui = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});
const data = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Ink and Signal | DriftGate",
  description: "DriftGate Phase 0 design system. All release specimens are demonstration data.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${ui.variable} ${display.variable} ${data.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('driftgate-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
