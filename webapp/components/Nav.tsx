"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y < 56) {
        setVisible(true);
      } else if (y > lastScrollY.current) {
        setVisible(false);
        setMenuOpen(false);
      } else {
        setVisible(true);
      }
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Close menu when clicking outside */
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  /* Close menu on route change */
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);

  return (
    <>
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

          {/* Desktop nav links — hidden on small screens */}
          <div className="hidden md:flex items-center gap-1 ml-auto">
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

          {/* Hamburger button — visible only on small screens */}
          <button
            ref={buttonRef}
            onClick={toggleMenu}
            className="md:hidden ml-auto p-2 text-stone-400 hover:text-[#D4F72A] transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      <div
        ref={menuRef}
        className="fixed left-0 right-0 z-40 md:hidden overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          top: "3.5rem",
          transform: visible ? "translateY(0)" : "translateY(-100%)",
          maxHeight: menuOpen ? "16rem" : "0",
          opacity: menuOpen ? 1 : 0,
        }}
      >
        <div className="bg-[#111111] border-b border-stone-800 px-4 py-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2.5 text-sm transition-colors rounded-sm ${
                  isActive
                    ? "bg-white text-[#111111] font-bold"
                    : "text-stone-400 hover:text-[#D4F72A] hover:bg-stone-800/50"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="uppercase tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
