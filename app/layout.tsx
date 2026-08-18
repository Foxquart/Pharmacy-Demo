import type { Metadata, Viewport } from "next";
import { Lexend, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

/**
 * Lexend is the product typeface. It was designed to reduce visual stress and
 * raise reading speed, which is exactly the right property for a counter tool
 * read in glances by someone with a queue in front of them.
 */
const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

/**
 * Inter carries every number in the product.
 *
 * Lexend ships no tabular figures, so numerals needed a second face. Inter is
 * the right one: its `tnum` figures are genuinely tabular, so money columns
 * align and totals do not jitter as they tick, but unlike a monospace it still
 * reads as ordinary text. Opening hours and phone numbers should look like
 * information, not like a terminal.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

/**
 * Reserved for genuinely code-like content only: webhook payloads, HMAC
 * signatures, the raw UPI intent string. Not for money, dates or quantities.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://pharmacy-demo.foxquart.com",
  ),
  title: {
    default: "Meridian - pharmacy counter software",
    template: "%s · Meridian",
  },
  description:
    "Billing, UPI collection and batch-level stock control for independent pharmacies. Scan, bill, get paid, and watch stock settle itself. A Foxquart demo.",
  applicationName: "Meridian",
  authors: [{ name: "Foxquart", url: "https://foxquart.com" }],
  creator: "Foxquart",
  publisher: "Foxquart",
  keywords: [
    "pharmacy software",
    "pharmacy billing",
    "UPI payments",
    "inventory management",
    "batch expiry tracking",
    "medical store POS",
  ],
  openGraph: {
    type: "website",
    siteName: "Meridian by Foxquart",
    url: "https://pharmacy-demo.foxquart.com",
    title: "Meridian - pharmacy counter software",
    description:
      "Scan a barcode, show a UPI QR, and let stock settle itself. Batch-level expiry tracking for independent pharmacies.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Meridian - pharmacy counter software",
    description:
      "Scan a barcode, show a UPI QR, and let stock settle itself. Batch-level expiry tracking for independent pharmacies.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1d20" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${lexend.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-dvh bg-bg text-text antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  "!bg-surface !text-text !border-border !shadow-lg !rounded-[var(--radius-md)]",
                description: "!text-text-secondary",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
