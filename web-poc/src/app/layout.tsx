import type { Metadata, Viewport } from "next";
import { Fraunces, Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "../styles/app.css";

const schibsted = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz", "WONK"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NeuroCal",
  description: "Log meals from a photo and see what to eat next for how you want to think and feel.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9eef0" },
    { media: "(prefers-color-scheme: dark)", color: "#151b2c" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${schibsted.variable} ${fraunces.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
