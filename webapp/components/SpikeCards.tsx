"use client";

import { useState } from "react";
import type { EventAnalysisEntry } from "@/lib/data";
import { formatMoney } from "@/lib/utils";

interface SpikeCardsProps {
  spikes: EventAnalysisEntry[];
  sectorColors: Record<string, string>;
}

function formatEventType(eventType: string): string {
  return eventType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function SpikeCards({ spikes, sectorColors }: SpikeCardsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setExpandedIndex((prev) => (prev === index ? null : index));
  }

  if (spikes.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        No legislative spike events found.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {spikes.map((spike, i) => {
        const isExpanded = expandedIndex === i;
        const ratio = spike.spike_ratio ?? 0;
        const isHot = ratio >= 2.0;
        const baseline = spike.baseline_weekly_avg;
        const eventWeek = spike.event_week_total;
        const total = baseline + eventWeek;

        return (
          <div
            key={`${spike.bill}-${spike.date}-${spike.sector}-${i}`}
            className={`border-b border-stone-200 py-4 cursor-pointer transition-colors ${
              isExpanded ? "bg-stone-50" : "hover:bg-stone-50"
            }`}
            onClick={() => toggle(i)}
          >
            {/* Row 1: Bill number + title */}
            <div className="flex items-start gap-1">
              <p className="text-sm leading-snug">
                <span className="font-semibold text-stone-900">
                  {spike.bill}
                </span>
                <span className="text-stone-400"> — </span>
                <span className="text-stone-600 line-clamp-1">
                  {spike.bill_title}
                </span>
              </p>
            </div>

            {/* Row 2: Event type + date */}
            <p className="text-xs text-stone-500 mt-1">
              {formatEventType(spike.event_type)}
              <span className="mx-1">&middot;</span>
              {formatDate(spike.date)}
            </p>

            {/* Row 3: Sector dots + spike badge */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 flex-wrap">
                {spike.sectors_affected.map((sector) => (
                  <span
                    key={sector}
                    className="inline-flex items-center gap-1 text-[11px] text-stone-600"
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: sectorColors[sector] || "#9CA3AF",
                      }}
                    />
                    {sector}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                    isHot
                      ? "bg-[#FE4F40] text-white"
                      : "bg-stone-100 text-stone-700"
                  }`}
                >
                  {ratio != null ? `${ratio.toFixed(1)}x` : "N/A"}
                </span>
                <span className="text-xs text-stone-500">
                  {formatMoney(eventWeek)}
                </span>
              </div>
            </div>

            {/* Expand indicator */}
            <div className="flex justify-end mt-1">
              <span className="text-[10px] text-stone-400">
                {isExpanded ? "Hide details" : "Details"}{" "}
                {isExpanded ? "\u25B4" : "\u25BE"}
              </span>
            </div>

            {/* Expanded section */}
            {isExpanded && (
              <div className="pt-4 mt-4 border-t border-[#C8C1B6]/30 space-y-4">
                {/* What this bill does */}
                <div>
                  <h4
                    className="text-xs uppercase tracking-[0.2em] text-stone-600 mb-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    What this bill does
                  </h4>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {spike.editorial_summary}
                  </p>
                </div>

                {/* Who had skin in the game */}
                <div>
                  <h4
                    className="text-xs uppercase tracking-[0.2em] text-stone-600 mb-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Who had skin in the game
                  </h4>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {spike.industry_interest}
                  </p>
                </div>

                {/* The money */}
                <div>
                  <h4
                    className="text-xs uppercase tracking-[0.2em] text-stone-600 mb-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    The money
                  </h4>
                  <p className="text-xs text-stone-600 mb-2">
                    Baseline: {formatMoney(baseline)}/wk{" "}
                    <span className="text-stone-400 mx-1">&rarr;</span> Event
                    week: {formatMoney(eventWeek)}
                  </p>
                  {total > 0 && (
                    <div className="flex h-5 rounded overflow-hidden">
                      <div
                        className="bg-stone-200 flex items-center justify-center"
                        style={{ width: `${(baseline / total) * 100}%` }}
                      >
                        {baseline / total > 0.15 && (
                          <span className="text-[9px] text-stone-500 px-1 truncate">
                            {formatMoney(baseline)}
                          </span>
                        )}
                      </div>
                      <div
                        className={`flex items-center justify-center ${
                          isHot ? "bg-[#FE4F40]" : "bg-[#4C6971]"
                        }`}
                        style={{ width: `${(eventWeek / total) * 100}%` }}
                      >
                        {eventWeek / total > 0.15 && (
                          <span className="text-[9px] text-white px-1 truncate">
                            {formatMoney(eventWeek)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="inline-flex items-center gap-1 text-[9px] text-stone-400">
                      <span className="inline-block w-2 h-2 rounded-sm bg-stone-200" />
                      Baseline
                    </span>
                    <span className="inline-flex items-center gap-1 text-[9px] text-stone-400">
                      <span
                        className={`inline-block w-2 h-2 rounded-sm ${
                          isHot ? "bg-[#FE4F40]" : "bg-[#4C6971]"
                        }`}
                      />
                      Event week
                    </span>
                  </div>
                </div>

                {/* What happened */}
                {spike.outcome && (
                  <div>
                    <h4
                      className="text-xs uppercase tracking-[0.2em] text-stone-600 mb-1"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      What happened
                    </h4>
                    <p className="text-sm text-stone-700 leading-relaxed">
                      {spike.outcome}
                    </p>
                  </div>
                )}

                {/* Source */}
                <div className="flex items-center justify-between text-xs text-stone-400 pt-1">
                  <span>Source: FEC bulk data, 2024 cycle</span>
                  {spike.congress_url && (
                    <a
                      href={spike.congress_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#4C6971] hover:underline text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Congress.gov &rarr;
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
