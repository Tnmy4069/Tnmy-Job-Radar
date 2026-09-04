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
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIDEBAR_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase, badge: "2.1k" },
  { href: "/recommended", label: "Recommended", icon: Sparkles, badge: "12" },
  { href: "/saved", label: "Saved", icon: Bookmark, badge: "8" },
  { href: "/applications", label: "Applications", icon: Send },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/skills", label: "Skills / Market", icon: Cpu },
  { href: "/analytics", label: "Analytics", icon: LineChart },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isSidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-accent/30 text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 z-30",
          isSidebarOpen ? "w-64" : "w-[68px]"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border shrink-0">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight overflow-hidden whitespace-nowrap">
            <Radar className="h-5 w-5 shrink-0 text-accent dark:text-accent-foreground" />
            {isSidebarOpen && <span>Job Radar</span>}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hidden sm:flex"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {SIDEBAR_NAV.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href as "/"}
                title={!isSidebarOpen ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative group",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {isSidebarOpen && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}
                {isSidebarOpen && item.badge && (
                  <span className={cn(
                    "ml-auto text-xs font-semibold px-2 py-0.5 rounded-full",
                    isActive ? "bg-background text-foreground" : "bg-muted-foreground/20 text-muted-foreground group-hover:text-foreground"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 mt-auto border-t border-sidebar-border">
          <Link
            href="/settings"
            title={!isSidebarOpen ? "Settings" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/settings"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {isSidebarOpen && <span>Settings</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 lg:px-6 shrink-0 z-20">
          {/* Mobile Sidebar Toggle - visible only on small screens */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground sm:hidden"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>

          {/* Global Search */}
          <div className="flex-1 flex items-center max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search jobs, companies, skills... (Cmd+K)"
                className="w-full bg-muted/50 border border-transparent rounded-md pl-9 pr-4 py-1.5 text-sm outline-none focus:bg-background focus:border-border focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto shrink-0">
            {/* Scan Status */}
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span>Scan healthy</span>
            </div>
            
            <div className="h-4 w-[1px] bg-border hidden md:block mx-1" />

            <Button variant="ghost" size="icon" className="h-8 w-8 relative text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-accent"></span>
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background focus:outline-none">
          <div className="h-full w-full mx-auto max-w-7xl">{children}</div>
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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between px-4 lg:px-6 pt-6">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyHint({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm">
        {icon ?? <Building2 className="h-5 w-5" />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">{body}</p>
      {action ? (
        <div className="mt-6 flex justify-center">{action}</div>
      ) : (
        <Link href="/settings" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-accent transition-colors">
          <Settings className="h-4 w-4" />
          Review settings
        </Link>
      )}
    </div>
  );
}
