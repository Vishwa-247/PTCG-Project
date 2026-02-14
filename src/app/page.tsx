'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon } from "lucide-react";

export default function HomePage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Initialize theme
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            🏠 Premier Realty AI
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/call">Voice Agent</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.3_0.08_260)_0%,transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center">
          <Badge variant="secondary" className="mb-6 text-sm">
            AI-Powered Real Estate Platform
          </Badge>
          <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Intelligent{" "}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Real Estate
            </span>{" "}
            Voice Agent
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Voice-driven lead qualification with transparent AI reasoning,
            real-time CRM updates, and intelligent appointment booking.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/call">📞 Start Voice Call</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">View Dashboard →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: "🧠",
              title: "Transparent Reasoning",
              desc: "See exactly how the AI decides — confidence scores, strategy selection, and rejected alternatives.",
            },
            {
              icon: "🎙️",
              title: "Voice-First Interface",
              desc: "Natural conversation via Vapi AI with real-time transcription and live reasoning trace.",
            },
            {
              icon: "📊",
              title: "Smart Lead Scoring",
              desc: "Weighted readiness score combining intent, urgency, budget, timeline, and location confidence.",
            },
            {
              icon: "🛡️",
              title: "Graceful Fallbacks",
              desc: "Handles LLM timeouts, low confidence, and malicious input with transparent degradation.",
            },
          ].map((f) => (
            <Card
              key={f.title}
              className="group border-border/50 bg-card/50 transition-all hover:border-border hover:bg-card"
            >
              <CardContent className="p-6">
                <div className="mb-4 text-3xl">{f.icon}</div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="border-t border-border/40 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-8 text-center text-2xl font-bold">Built With</h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              "Vapi AI",
              "Deepgram",
              "ElevenLabs",
              "Groq (Llama 3.3 70B)",
              "Next.js 14",
              "Supabase",
              "Vercel",
            ].map((t) => (
              <Badge key={t} variant="outline" className="px-4 py-2 text-sm">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
