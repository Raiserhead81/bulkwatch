import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider } from "@/lib/i18n";

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
    "Live database of bulk carriers worldwide with specs, price estimates, Buy/Hold/Sell recommendations and route tracking.",
  keywords: [
    "Bulk Carrier",
    "Maritime",
    "AIS",
    "Shipping",
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
        <I18nProvider>
          {children}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
