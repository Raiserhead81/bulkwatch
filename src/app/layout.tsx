import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BulkWatch — Bulk Carrier Intelligence Database",
  description:
    "Live-Datenbank aller Bulk Carrier weltweit mit Specs, Preis-Schätzungen, Buy/Hold/Sell Empfehlungen und Routen-Tracking.",
  keywords: [
    "Bulk Carrier",
    "Schifffahrt",
    "AIS",
    "Maritime",
    "Frachtschiffe",
    "Capesize",
    "Panamax",
    "Handysize",
    "Valemax",
  ],
  authors: [{ name: "BulkWatch" }],
  openGraph: {
    title: "BulkWatch",
    description: "Bulk Carrier Intelligence Database",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
