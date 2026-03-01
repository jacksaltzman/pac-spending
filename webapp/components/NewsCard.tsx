"use client";

import { useState } from "react";
import type { NewsEntry } from "@/lib/data";

interface NewsCardsProps {
  articles: NewsEntry[];
  sectorColors: Record<string, string>;
}

function SectorDot({ sector, color }: { sector: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-stone-500">
      <span
        className="w-2 h-2 rounded-full inline-block flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {sector}
    </span>
  );
}

export default function NewsCards({ articles, sectorColors }: NewsCardsProps) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_COUNT = 3;

  if (articles.length === 0) return null;

  const visible = expanded ? articles : articles.slice(0, INITIAL_COUNT);
  const hasMore = articles.length > INITIAL_COUNT;

  return (
    <section>
      <h2
        className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        In the News
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block py-4 border-b border-stone-200 hover:bg-stone-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <SectorDot
                sector={article.sector}
                color={sectorColors[article.sector] || "#9CA3AF"}
              />
              <span className="text-[10px] text-stone-400 whitespace-nowrap flex-shrink-0">
                {formatDate(article.date)}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-[#111111] leading-snug mb-2 group-hover:text-[#4C6971] transition-colors">
              {article.title}
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed mb-3 line-clamp-3">
              {article.excerpt}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
                {article.source}
              </span>
              <span className="text-stone-300 group-hover:text-[#4C6971] transition-colors text-xs">
                &rarr;
              </span>
            </div>
          </a>
        ))}
      </div>
      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#4C6971] hover:text-[#111111] transition-colors underline underline-offset-2"
          >
            {expanded ? "Show less" : `Show all ${articles.length} articles`}
          </button>
        </div>
      )}
    </section>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
