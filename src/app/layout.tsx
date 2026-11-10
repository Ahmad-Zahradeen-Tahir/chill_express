import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import "./globals.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-barlow",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: { default: "Chill. Express — Order online · Maiduguri", template: "%s · Chill. Express" },
  description: "Order shawarma, burgers, loaded fries and drinks from Chill. Express, Maiduguri. Pickup or delivery from Gombole Road and Lagos Street.",
  icons: { icon: "/images/brand/logo-mark.png" },
};

export const viewport: Viewport = {
  themeColor: "#FBAE14",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${barlow.variable} ${dmSans.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
