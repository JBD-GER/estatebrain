import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Estate Brain – Immobilien wirtschaftlich klar steuern",
    template: "%s | Estate Brain",
  },
  description:
    "Cashflow, Mieten, Ausgaben, Finanzierungen, Belege und geschätzte Steuerwirkungen in einer sicheren Immobilienverwaltung.",
  applicationName: "Estate Brain",
  keywords: [
    "Immobilienverwaltung",
    "Cashflow",
    "Vermieter",
    "Portfolio",
    "Mietverwaltung",
  ],
  authors: [{ name: "Estate Brain" }],
  creator: "Estate Brain",
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "Estate Brain",
    title: "Deine Immobilien. Deine Zahlen. Ein klarer Überblick.",
    description:
      "Die zentrale Finanz- und Portfolioübersicht für private Immobilieninvestoren.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Estate Brain",
    description:
      "Cashflow, Portfolio und Unterlagen für private Immobilieninvestoren.",
  },
  robots: {
    index: process.env.NEXT_PUBLIC_LEGAL_READY === "true",
    follow: process.env.NEXT_PUBLIC_LEGAL_READY === "true",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider delayDuration={250}>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
