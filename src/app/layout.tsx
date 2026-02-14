import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Premier Realty AI — Intelligent Real Estate Voice Agent",
  description:
    "AI-powered voice agent for real estate lead qualification with transparent reasoning, real-time CRM, and intelligent appointment booking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
