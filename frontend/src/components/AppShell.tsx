"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  ClipboardList,
  FileClock,
  FlaskConical,
  LayoutDashboard,
  Map,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { ReliefDataProvider, useReliefData } from "@/components/ReliefDataContext";

const navigationGroups = [
  { label: "Situation", items: [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/map", label: "Situation Map", icon: Map },
  ] },
  { label: "Response", items: [
    { href: "/allocations", label: "Active Allocations", icon: ClipboardList },
    { href: "/simulation", label: "Simulation", icon: Siren },
  ] },
  { label: "Planning", items: [
    { href: "/predictions", label: "Predictions", icon: Activity },
    { href: "/strategy-lab", label: "Strategy Lab", icon: FlaskConical },
  ] },
  { label: "Governance", items: [
    { href: "/audit", label: "Audit Trail", icon: FileClock },
  ] },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ReliefDataProvider pathname={pathname}>
      <ShellContent pathname={pathname}>{children}</ShellContent>
    </ReliefDataProvider>
  );
}

function ShellContent({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { twin, allocations } = useReliefData();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
    document.querySelector(".app-content")?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  const scenarioName = twin?.scenario?.name || "Scenario status unavailable";
  const stateVersion = twin?.state_version;

  return (
    <div className="app-frame">
      <aside className="relief-sidebar">
        <Link href="/" className="relief-brand">
          <span className="relief-brand-mark"><ShieldCheck size={21} /></span>
          <span>
            <span className="block text-[18px] font-bold leading-tight">ReliefOS</span>
            <span className="block text-[10px] text-slate-400">RESPONSE COMMAND</span>
          </span>
        </Link>

        <nav className="relief-navigation" aria-label="Main navigation">
          {navigationGroups.map((group) => (
            <div className="relief-nav-group" key={group.label}>
              <div className="relief-nav-group-label">{group.label}</div>
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch
                    aria-current={active ? "page" : undefined}
                    data-pending={pendingPath === href && !active ? "true" : undefined}
                    className="relief-nav-link"
                    onClick={(event) => {
                      if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                        setPendingPath(href);
                      }
                    }}
                  >
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-scenario">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Active scenario
          </div>
          <div className="mt-2 truncate text-xs font-semibold text-white" title={scenarioName}>{scenarioName}</div>
          <div className="mt-1 text-[10px] text-slate-400">Active = selected scenario for updates</div>
        </div>
      </aside>

      <div className="app-main-column">
        <header className="app-topbar">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-900">ReliefOS</span>
            <span className="hidden h-5 border-l border-slate-200 sm:block" />
            <div>
              <div className="topbar-item-label">Active Scenario</div>
              <div className="topbar-item-value max-w-[260px] truncate" title={scenarioName}>{scenarioName}</div>
            </div>
          </div>
          <div className="topbar-meta">
            <span className="simulation-indicator">Simulation Mode</span>
            <div>
              <div className="topbar-item-label" title="Current version of the simulated scenario state">Scenario state</div>
              <div className="topbar-item-value">{stateVersion != null ? `v${stateVersion}` : "--"}</div>
            </div>
            <div>
              <div className="topbar-item-label">Allocations</div>
              <div className="topbar-item-value">{twin ? allocations.length : "--"} tracked</div>
            </div>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}