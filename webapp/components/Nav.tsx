"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/members", label: "Members" },
  { href: "/pacs", label: "PACs" },
  { href: "/methodology", label: "Methodology" },
];

export default function Nav() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y < 56) {
        setVisible(true);
      } else if (y > lastScrollY.current) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 h-14 bg-[#111111] border-b border-stone-800 flex items-center px-4 sm:px-6 lg:px-8 z-50 transition-transform duration-200"
      style={{ transform: visible ? "translateY(0)" : "translateY(-100%)" }}
    >
      <div className="flex items-center gap-6 w-full max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <img
            src="/accountable_logo.avif"
            alt="Accountable"
            className="h-6 w-auto"
          />
          <span
            className="hidden sm:inline text-xs text-stone-400 uppercase tracking-widest"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Geographic Mismatch
          </span>
        </Link>

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
      </div>
    </nav>
  );
}
