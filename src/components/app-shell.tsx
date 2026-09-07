"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Sparkles,
  Bookmark,
  Send,
  Building2,
  Cpu,
  LineChart,
  Settings,
  Radar,
  Moon,
  Sun,
  Search,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIDEBAR_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase, badge: "2.1k" },
  { href: "/recommended", label: "Recommended", icon: Sparkles, badge: "12" },
  { href: "/saved", label: "Saved", icon: Bookmark, badge: "8" },
  { href: "/applications", label: "Applications", icon: Send },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/skills", label: "Skills / Market", icon: Cpu },
  { href: "/analytics", label: "Analytics", icon: LineChart },
];

const MOBILE_BREAKPOINT = 1024;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isDesktop, setIsDesktop] = React.useState(false);
  const [desktopOpen, setDesktopOpen] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const hideShell =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/onboarding";

  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`);
    const sync = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setMobileOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  if (hideShell) {
    return <div className="h-full w-full bg-background text-foreground">{children}</div>;
  }

  const sidebarExpanded = isDesktop ? desktopOpen : true;

  return (
    <div className="flex h-dvh w-full bg-background overflow-hidden selection:bg-accent/30 text-foreground">
      {/* Mobile/tablet backdrop */}
      <div
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar — drawer below lg, inline rail on laptop+ */}
      <aside
        className={cn(
          "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out z-50",
          "fixed inset-y-0 left-0 w-[min(18rem,88vw)] lg:static lg:z-30",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isDesktop && (desktopOpen ? "lg:w-64" : "lg:w-[68px]")
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 text-sm font-semibold tracking-tight overflow-hidden whitespace-nowrap"
            onClick={() => setMobileOpen(false)}
          >
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
              <Radar className="h-4 w-4 text-primary" />
            </div>
            {sidebarExpanded && <span className="font-bold text-base">Job Radar</span>}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground hidden lg:flex rounded-md"
            onClick={() => setDesktopOpen((open) => !open)}
            aria-label={desktopOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {desktopOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain py-6 px-3 space-y-1.5">
          {SIDEBAR_NAV.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href as "/dashboard"}
                title={!sidebarExpanded ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative group",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-primary" : "group-hover:text-foreground"
                  )}
                />
                {sidebarExpanded && <span className="flex-1 truncate">{item.label}</span>}
                {sidebarExpanded && item.badge && (
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-foreground/10 text-muted-foreground group-hover:bg-muted-foreground/20 group-hover:text-foreground"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 mt-auto border-t border-sidebar-border bg-sidebar/50 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            href="/settings"
            title={!sidebarExpanded ? "Settings" : undefined}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              pathname === "/settings"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {sidebarExpanded && <span>Settings</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex h-14 items-center gap-2 sm:gap-4 border-b border-border bg-background px-3 sm:px-4 lg:px-6 shrink-0 z-20">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>

          <div className="flex-1 flex items-center min-w-0 max-w-md">
            <div className="relative w-full group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                type="text"
                placeholder="Search jobs…"
                className="w-full bg-muted/40 border border-transparent rounded-full pl-10 pr-4 py-1.5 text-sm outline-none focus:bg-background focus:border-border focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
                aria-label="Search jobs, companies, skills"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/30 px-3 py-1 rounded-full border border-border/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span>Scan healthy</span>
            </div>

            <div className="h-4 w-px bg-border hidden lg:block mx-1" />

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 relative text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-full transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-primary border-2 border-background" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-full transition-colors"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background/50 focus:outline-none scroll-smooth overscroll-contain">
          <div className="h-full w-full mx-auto max-w-[1400px] p-3 sm:p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action ? <div className="flex w-full sm:w-auto flex-wrap gap-2 shrink-0 [&_a]:flex-1 [&_button]:flex-1 sm:[&_a]:flex-none sm:[&_button]:flex-none">{action}</div> : null}
    </div>
  );
}

export function EmptyHint({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-10 sm:px-6 sm:py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm">
        {icon ?? <Building2 className="h-5 w-5" />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">{body}</p>
      {action ? (
        <div className="mt-6 flex justify-center">{action}</div>
      ) : (
        <Link
          href="/settings"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-accent transition-colors"
        >
          <Settings className="h-4 w-4" />
          Review settings
        </Link>
      )}
    </div>
  );
}
