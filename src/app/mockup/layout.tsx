import type { Metadata } from "next";
import { Inter, Playfair_Display, Source_Code_Pro, Kalam } from "next/font/google";
import "./tokens.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--fo-font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--fo-font-serif",
});

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--fo-font-mono",
});

const kalam = Kalam({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--fo-font-kalam",
});

export const metadata: Metadata = {
  title: "Mockup · Field Ops",
  robots: { index: false, follow: false },
};

export default function MockupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`mockup-root ${inter.variable} ${playfair.variable} ${sourceCodePro.variable} ${kalam.variable}`}
    >
      {children}
    </div>
  );
}
