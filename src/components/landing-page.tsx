"use client";

import Link from "next/link";
import { Radar, ArrowRight, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-accent/30">
      <header className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Radar className="h-6 w-6 text-accent" />
          <span className="text-lg font-bold tracking-tight">Job Radar</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Button asChild className="rounded-full">
            <Link href="/register">Get Started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="container mx-auto flex flex-col items-center justify-center px-4 md:px-6 pt-16 sm:pt-20 md:pt-24 pb-20 sm:pb-28 md:pb-32 text-center">
          <div className="inline-flex max-w-full items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8">
            <Sparkles className="mr-2 h-4 w-4 shrink-0" />
            <span className="font-medium truncate">The new standard for job hunting</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl md:text-7xl lg:text-8xl bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent pb-2 sm:pb-4">
            Find your next role with AI precision.
          </h1>
          <p className="max-w-[42rem] leading-normal text-muted-foreground text-base sm:text-xl sm:leading-8 mt-4 mb-8 sm:mb-10">
            Job Radar automatically scans top product companies, analyzes job descriptions, and matches them to your exact profile using advanced AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto max-w-sm sm:max-w-none">
            <Button size="lg" className="rounded-full px-8 h-12 text-base shadow-lg shadow-accent/20 w-full sm:w-auto" asChild>
              <Link href="/register">
                Start your search <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 h-12 text-base glass w-full sm:w-auto" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border bg-muted/30 py-16 sm:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-6 sm:gap-8 lg:gap-12 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-4 p-5 sm:p-6 glass-card rounded-2xl">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold">Real-time Scanning</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We monitor career pages 24/7 so you are always the first to know when a new role opens up.
                </p>
              </div>
              <div className="flex flex-col gap-4 p-5 sm:p-6 glass-card rounded-2xl">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                  <ShieldCheck className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold">Curated Quality</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Only premium product companies. No agencies, no spam, no low-quality listings.
                </p>
              </div>
              <div className="flex flex-col gap-4 p-5 sm:p-6 glass-card rounded-2xl sm:col-span-2 lg:col-span-1">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                  <Sparkles className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold">AI Matchmaking</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Every job is scored against your profile to show you exactly why you&apos;re a fit (or why you&apos;re not).
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 md:px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Job Radar. Built for early-career software engineers.
        </div>
      </footer>
    </div>
  );
}
