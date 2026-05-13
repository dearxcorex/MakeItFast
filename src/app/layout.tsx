import type { Metadata } from "next";
import { Exo_2, Orbitron, Prompt, Noto_Sans_Thai, Inter, Playfair_Display, Source_Code_Pro, Kalam } from "next/font/google";
import "./globals.css";
import "./field-ops.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UserProvider } from "@/contexts/UserContext";

const exo2 = Exo_2({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
});

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-prompt",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-thai",
});

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
  title: "Field Ops | NBTC FM + Interference Tracker",
  description: "Unified field operations surface for FM station inspection and interference site monitoring",
  keywords: "FM radio, interference, NBTC, field ops, inspection, intermodulation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = [
    exo2.variable,
    orbitron.variable,
    prompt.variable,
    notoSansThai.variable,
    inter.variable,
    playfair.variable,
    sourceCodePro.variable,
    kalam.variable,
  ].join(" ");

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${fontVars} font-sans antialiased`} suppressHydrationWarning>
        <UserProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </UserProvider>
      </body>
    </html>
  );
}
