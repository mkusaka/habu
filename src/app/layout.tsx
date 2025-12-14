import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { BackgroundSyncFallback } from "@/components/background-sync";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeColorSync } from "@/components/theme-color-sync";

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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "habu",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const manifestVersion = process.env.NEXT_PUBLIC_GIT_SHA ?? "dev";
  const appleSplashScreens = [
    // iPhone
    { w: 430, h: 932, pr: 3, file: "1290x2796" },
    { w: 428, h: 926, pr: 3, file: "1284x2778" },
    { w: 414, h: 896, pr: 3, file: "1242x2688" },
    { w: 393, h: 852, pr: 3, file: "1179x2556" },
    { w: 390, h: 844, pr: 3, file: "1170x2532" },
    { w: 375, h: 812, pr: 3, file: "1125x2436" },
    { w: 414, h: 736, pr: 3, file: "1242x2208" },
    { w: 414, h: 896, pr: 2, file: "828x1792" },
    { w: 375, h: 667, pr: 2, file: "750x1334" },

    // iPad
    { w: 1024, h: 1366, pr: 2, file: "2048x2732" },
    { w: 834, h: 1194, pr: 2, file: "1668x2388" },
    { w: 834, h: 1112, pr: 2, file: "1668x2224" },
    { w: 810, h: 1080, pr: 2, file: "1620x2160" },
    { w: 768, h: 1024, pr: 2, file: "1536x2048" },
    { w: 744, h: 1133, pr: 2, file: "1488x2266" },
  ];

  return (
    <html lang="ja" className="h-dvh overflow-hidden" suppressHydrationWarning>
      <head>
        <link rel="manifest" href={`/manifest.json?v=${manifestVersion}`} />
        <link
          rel="manifest"
          href={`/manifest-dark.json?v=${manifestVersion}`}
          media="(prefers-color-scheme: dark)"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {appleSplashScreens.map(({ w, h, pr, file }) => (
          <link
            key={`${file}-light`}
            rel="apple-touch-startup-image"
            href={`/apple-splash/splash-${file}-light.png`}
            media={`(prefers-color-scheme: light) and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${pr}) and (orientation: portrait)`}
          />
        ))}
        {appleSplashScreens.map(({ w, h, pr, file }) => (
          <link
            key={`${file}-dark`}
            rel="apple-touch-startup-image"
            href={`/apple-splash/splash-${file}-dark.png`}
            media={`(prefers-color-scheme: dark) and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${pr}) and (orientation: portrait)`}
          />
        ))}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full overflow-hidden`}
      >
        <ThemeProvider>
          <ThemeColorSync />
          <ServiceWorkerRegister />
          <BackgroundSyncFallback />
          <TooltipProvider>
            <main className="h-full p-2 bg-background overflow-auto">
              <div className="min-h-full flex items-center">
                <div className="max-w-lg mx-auto w-full">{children}</div>
              </div>
            </main>
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
