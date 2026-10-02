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
  title: "Tommy Ngo Nguyen",
  description:
    "Tommy Ngo Nguyen. Where design, product and clothing meet.",
  openGraph: {
    title: "Tommy Ngo Nguyen",
    description:
      "Tommy Ngo Nguyen. Where design, product and clothing meet.",
    url: "/",
    siteName: "Tommy",
    locale: "en",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tommy Ngo Nguyen",
    description:
      "Tommy Ngo Nguyen. Where design, product and clothing meet.",
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
