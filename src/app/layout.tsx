import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Premier Realty AI — Intelligent Real Estate Voice Agent",
  description: "AI-powered voice agent for real estate lead qualification with transparent reasoning, real-time CRM, and intelligent appointment booking. Built for PTCG Hackathon 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
