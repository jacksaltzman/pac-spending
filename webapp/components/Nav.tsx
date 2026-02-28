"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/members", label: "Members" },
  { href: "/pacs", label: "PACs" },
  { href: "/stories", label: "Stories" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-[#111111] border-b border-stone-800 flex items-center px-4 sm:px-6 lg:px-8 z-50">
      <div className="flex items-center gap-6 w-full max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <span
            className="text-lg text-white font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            ACCOUNTABLE
          </span>
          <span
            className="hidden sm:inline text-xs text-stone-400 uppercase tracking-widest"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Geographic Mismatch
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 ml-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-white text-[#111111] font-bold rounded-sm"
                    : "text-stone-400 hover:text-[#D4F72A]"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="uppercase tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Version badge */}
        <span
          className="hidden md:inline bg-[#D4F72A] text-[#111111] rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          FEC 2024
        </span>
      </div>
    </nav>
  );
}
