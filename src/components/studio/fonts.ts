import { Libre_Caslon_Display, Special_Gothic } from "next/font/google";

// Studio pages (everything except the landing sheet): a grotesk for UI/body and a caps
// serif for titles. Both are Google Fonts (SIL Open Font License).
export const gothic = Special_Gothic({ subsets: ["latin"], weight: "variable", variable: "--font-gothic" });
// the display cut: high contrast and fine hairlines, closer to a printed caption
export const caslon = Libre_Caslon_Display({ subsets: ["latin"], weight: "400", variable: "--font-caslon" });

export const studioFontVars = `${gothic.variable} ${caslon.variable}`;
