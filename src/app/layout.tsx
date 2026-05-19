import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tommy-portfolio.vercel.app"),
  title: "Tommy — Developer & Maker",
  description:
    "Software engineer and textile maker. Building apps and sewing garments with the same precision.",
  openGraph: {
    title: "Tommy — Developer & Maker",
    description:
      "Software engineer and textile maker. Building apps and sewing garments with the same precision.",
    url: "/",
    siteName: "Tommy",
    locale: "en",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tommy — Developer & Maker",
    description:
      "Software engineer and textile maker. Building apps and sewing garments with the same precision.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
