"use client";

import { useState, useMemo } from "react";
import type { PacSpreadEntry } from "@/lib/data";
import { formatMoney } from "@/lib/utils";

type SortKey = "pac_name" | "total_given" | "num_recipients" | "r_total" | "d_total";
type SortDir = "asc" | "desc";

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-stone-300 ml-1">&udarr;</span>;
  return (
    <span className="text-[#FE4F40] ml-1">
      {dir === "asc" ? "\u2191" : "\u2193"}
    </span>
  );
}

function SectorBadge({ sector, color }: { sector: string; color: string }) {
  if (!sector) return null;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wide font-medium whitespace-nowrap"
      style={{
        fontFamily: "var(--font-display)",
        backgroundColor: `${color}18`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      {sector}
    </span>
  );
}

function PartyBar({ rTotal, dTotal }: { rTotal: number; dTotal: number }) {
  const total = rTotal + dTotal;
  if (total <= 0) return <span className="text-xs text-stone-400">--</span>;
  const rPct = (rTotal / total) * 100;
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-stone-100 flex">
        <div
          className="h-full bg-[#EF4444]"
          style={{ width: `${rPct}%` }}
        />
        <div
          className="h-full bg-[#3B82F6]"
          style={{ width: `${100 - rPct}%` }}
        />
      </div>
      <span className="text-[10px] text-stone-400 tabular-nums w-8 text-right">
        {Math.round(rPct)}R
      </span>
    </div>
  );
}

export default function PacsTable({
  pacs,
  sectorColors,
}: {
  pacs: PacSpreadEntry[];
  sectorColors: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("num_recipients");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const p of pacs) {
      if (p.sector) set.add(p.sector);
    }
    return Array.from(set).sort();
  }, [pacs]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    const result = pacs.filter((p) => {
      if (sector !== "all" && p.sector !== sector) return false;
      if (
        q &&
        !p.pac_name.toLowerCase().includes(q) &&
        !p.connected_org.toLowerCase().includes(q) &&
        !p.recipients.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "pac_name":
          av = a.pac_name;
          bv = b.pac_name;
          break;
        case "total_given":
          av = a.total_given;
          bv = b.total_given;
          break;
        case "num_recipients":
          av = a.num_recipients;
          bv = b.num_recipients;
          break;
        case "r_total":
          av = a.r_total;
          bv = b.r_total;
          break;
        case "d_total":
          av = a.d_total;
          bv = b.d_total;
          break;
        default:
          av = a.num_recipients;
          bv = b.num_recipients;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [pacs, search, sector, sortKey, sortDir]);

  function ColHeader({
    label,
    sortField,
    className,
  }: {
    label: string;
    sortField: SortKey;
    className?: string;
  }) {
    return (
      <th
        className={`px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500 cursor-pointer select-none hover:text-[#111111] transition-colors ${className ?? ""}`}
        style={{ fontFamily: "var(--font-display)" }}
        onClick={() => handleSort(sortField)}
      >
        {label}
        <SortArrow active={sortKey === sortField} dir={sortDir} />
      </th>
    );
  }

  return (
    <div>
      <h2
        className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        All PACs
      </h2>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span
            className="text-xs text-stone-500 uppercase tracking-[0.2em] mr-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Sector
          </span>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            aria-label="Filter by sector"
            className="bg-white border border-[#C8C1B6]/50 rounded-lg px-3 py-1.5 text-xs text-[#111111] focus:outline-none focus:border-[#FE4F40] transition-colors"
          >
            <option value="all">All Sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-[#C8C1B6]/50" />

        <input
          type="text"
          placeholder="Search PAC, org, or member name..."
          aria-label="Search PACs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-[#C8C1B6]/50 rounded-lg px-3 py-1.5 text-sm text-[#111111] placeholder-stone-400 focus:outline-none focus:border-[#FE4F40] w-72 transition-colors"
        />
      </div>

      <p className="text-xs text-stone-400 mb-3">
        {filtered.length} PAC{filtered.length !== 1 ? "s" : ""}
        {sector !== "all" ? ` in ${sector}` : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="border border-[#C8C1B6]/50 rounded-lg bg-white p-12 text-center">
          <p className="text-stone-600 text-sm">
            No PACs match the current filters.
          </p>
          <button
            onClick={() => {
              setSector("all");
              setSearch("");
            }}
            className="mt-4 text-xs text-[#FE4F40] hover:text-[#E5453A] transition-colors underline underline-offset-2"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="border border-[#C8C1B6]/50 rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB]">
                  <th
                    className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500 w-10"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    #
                  </th>
                  <ColHeader label="PAC / Organization" sortField="pac_name" />
                  <th
                    className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Sector
                  </th>
                  <ColHeader
                    label="Total Given"
                    sortField="total_given"
                    className="text-right"
                  />
                  <ColHeader
                    label="Members"
                    sortField="num_recipients"
                    className="text-right"
                  />
                  <th
                    className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500 min-w-[120px]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Party Split
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pac, i) => {
                  const isExpanded = expandedId === pac.pac_cmte_id;
                  const recipientList = pac.recipients
                    ? pac.recipients.split(",").map((r) => r.trim())
                    : [];

                  return (
                    <tr
                      key={`${pac.pac_cmte_id}-${i}`}
                      className={`border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-[#FDFBF9]"}`}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : pac.pac_cmte_id)
                      }
                    >
                      <td className="px-3 py-2.5 text-xs text-stone-400 align-top">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2.5 align-top max-w-md">
                        <div>
                          <p className="text-[#111111] font-medium text-sm leading-tight">
                            {pac.connected_org || pac.pac_name}
                          </p>
                          {pac.connected_org && (
                            <p className="text-[10px] text-stone-400 mt-0.5 truncate">
                              {pac.pac_name}
                            </p>
                          )}
                          {isExpanded && (
                            <div className="mt-3">
                              {pac.agenda && (
                                <p className="text-xs text-stone-600 mb-3 leading-relaxed italic">
                                  {pac.agenda}
                                </p>
                              )}
                              <p
                                className="text-[10px] uppercase tracking-wider text-stone-400 mb-2"
                                style={{ fontFamily: "var(--font-display)" }}
                              >
                                Recipients ({recipientList.length})
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {recipientList.map((name) => (
                                  <span
                                    key={name}
                                    className="px-2 py-0.5 text-[11px] bg-[#F5F0EB] border border-[#C8C1B6]/40 rounded-sm text-[#111111]"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <SectorBadge
                          sector={pac.sector}
                          color={sectorColors[pac.sector] || "#9CA3AF"}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#4C6971] font-medium tabular-nums align-top whitespace-nowrap">
                        {formatMoney(pac.total_given)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums align-top text-[#111111]">
                        {pac.num_recipients}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <PartyBar rTotal={pac.r_total} dTotal={pac.d_total} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
