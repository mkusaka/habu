import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { BackgroundSyncFallback } from "@/components/background-sync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "habu - Hatena Bookmark Utility",
  description: "Quick bookmark saving to Hatena Bookmark",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "habu",
  },
};

export const viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-dvh overflow-hidden">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full overflow-hidden`}>
        <ServiceWorkerRegister />
        <BackgroundSyncFallback />
        <main className="h-full p-4 bg-gray-50 overflow-auto">
          <div className="w-full max-w-lg mx-auto min-h-full flex items-center justify-center">
            <div className="w-full py-4">{children}</div>
          </div>
        </main>
        <Toaster />
      </body>
    </html>
  );
}
