import type { Metadata } from "next";
import { Red_Hat_Display } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const redHatDisplay = Red_Hat_Display({
  subsets: ["latin"],
  variable: "--font-red-hat-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pratiche Automud",
  description: "Gestione delle pratiche di acquisto veicoli Automud",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body className={redHatDisplay.variable}>{children}</body>
    </html>
  );
}
