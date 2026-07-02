import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css"
import { VersionChecker } from "@/components/version-checker";
import { Toaster } from "@/components/ui/toaster";
import GlobalNav from "@/components/global-nav";
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
  title: "Maritime AI — Global Ship Intelligence",
  description:
    "Global database of vessels worldwide with specs, AIS tracking, price estimates and Buy/Hold/Sell recommendations.",
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
  authors: [{ name: "Maritime AI" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Maritime AI",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
  openGraph: {
    title: "Maritime AI",
    description: "Global Ship Intelligence Database",
    type: "website",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem("vessel-theme");if(t==="light"){document.documentElement.classList.remove("dark");document.documentElement.classList.add("light")}var s=document.createElement("style");s.textContent=".dark{--background:oklch(0.22 0 0)!important;--card:oklch(0.27 0 0)!important;--popover:oklch(0.27 0 0)!important;--secondary:oklch(0.32 0 0)!important;--muted:oklch(0.32 0 0)!important;--accent:oklch(0.32 0 0)!important}html:not(.dark){--background:oklch(0.975 0.003 80)!important;--card:oklch(0.99 0.002 80)!important}";document.head.appendChild(s)})();` }} />
              <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        <I18nProvider>
          <GlobalNav />
          {children}
          <Toaster />
        </I18nProvider>
        <script dangerouslySetInnerHTML={{ __html: `if("serviceWorker"in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){try{r.update()}catch(e){};r.unregister()})});navigator.serviceWorker.addEventListener("controllerchange",function(){window.location.reload()});caches.keys().then(function(k){k.forEach(function(n){caches.delete(n)})})};if(window.applicationCache){try{window.applicationCache.swapCache()}catch(e){}}` }} />
      </body>
    </html>
  );
}
