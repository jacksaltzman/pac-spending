"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/pacs", label: "Overview" },
  { href: "/pacs/industry", label: "Industry Analysis" },
  { href: "/pacs/timing", label: "Timing & Events" },
  { href: "/pacs/explore", label: "Explore" },
];

export default function PacsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="max-w-7xl">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="mb-6">
        <h1
          className="text-3xl sm:text-5xl text-[#111111] mb-2 uppercase tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PAC Influence
        </h1>
        <p className="text-sm text-stone-600 max-w-4xl leading-relaxed">
          Political Action Committees funnel industry money directly to
          tax-writing committee members. This analysis shows which PACs have
          the broadest reach, which industries spend the most, and how they
          split their contributions across party lines.
        </p>
      </header>

      {/* ── Tab Navigation ──────────────────────────────── */}
      <nav className="flex gap-0 mb-8 border-b border-[#C8C1B6]/50 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/pacs"
              ? pathname === "/pacs"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-3 text-xs uppercase tracking-[0.15em] whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "border-[#FE4F40] text-[#111111] font-bold"
                  : "border-transparent text-stone-400 hover:text-[#111111] hover:border-[#C8C1B6]/50"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Tab Content ─────────────────────────────────── */}
      {children}
    </div>
  );
}
