"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Member } from "@/lib/data";
import { formatMoney, formatPct, sectorColor } from "@/lib/utils";

const COMMITTEES = [
  { value: "all", label: "All" },
  { value: "house_ways_and_means", label: "House W&M" },
  { value: "senate_finance", label: "Senate Finance" },
] as const;

const PARTIES = [
  { value: "all", label: "All" },
  { value: "R", label: "R" },
  { value: "D", label: "D" },
] as const;

type SortKey =
  | "member_name"
  | "pct_outside"
  | "total_itemized_amount"
  | "pct_dc_kstreet"
  | "pct_in_home"
  | "alignment_pct";

type SortDir = "asc" | "desc";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function partyBadge(party: string): { bg: string; text: string } {
  if (party === "R") return { bg: "#FEE2E2", text: "#991B1B" };
  if (party === "D") return { bg: "#DBEAFE", text: "#1E40AF" };
  return { bg: "#F5F5F4", text: "#44403C" };
}

function outsidePctColor(pct: number): string {
  if (pct > 70) return "#FE4F40";
  if (pct > 50) return "#F59E0B";
  return "#4C6971";
}

function stateDistrict(m: Member): string {
  if (m.chamber === "house" && m.district != null) {
    return `${m.state}-${String(m.district).padStart(2, "0")}`;
  }
  return m.state;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-sm border transition-colors uppercase tracking-wide ${
        active
          ? "bg-[#111111] border-[#111111] text-white"
          : "bg-transparent border-[#C8C1B6]/50 text-stone-500 hover:border-[#C8C1B6] hover:text-[#111111]"
      }`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {children}
    </button>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-stone-300 ml-1">&udarr;</span>;
  return (
    <span className="text-[#FE4F40] ml-1">
      {dir === "asc" ? "\u2191" : "\u2193"}
    </span>
  );
}

export default function MembersTable({ members: allMembers }: { members: Member[] }) {
  const router = useRouter();
  const [committee, setCommittee] = useState("all");
  const [party, setParty] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("alignment_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const members = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = allMembers.filter((m) => {
      if (m.is_territorial) return false;
      if (m.total_itemized_amount === 0) return false;
      if (committee !== "all" && m.committee !== committee) return false;
      if (party !== "all" && m.party !== party) return false;
      if (
        q &&
        !m.member_name.toLowerCase().includes(q) &&
        !m.state.toLowerCase().includes(q) &&
        !(m.top_funder_agendas ?? "").toLowerCase().includes(q) &&
        !(m.top_funding_sector ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let av: number | string;
      let bv: number | string;

      switch (sortKey) {
        case "member_name":
          av = a.member_name;
          bv = b.member_name;
          break;
        case "pct_outside":
          av = a.pct_outside;
          bv = b.pct_outside;
          break;
        case "pct_dc_kstreet":
          av = a.pct_dc_kstreet;
          bv = b.pct_dc_kstreet;
          break;
        case "pct_in_home":
          av = a.pct_in_home;
          bv = b.pct_in_home;
          break;
        case "total_itemized_amount":
          av = a.total_itemized_amount;
          bv = b.total_itemized_amount;
          break;
        case "alignment_pct":
          av = a.alignment_pct ?? -1;
          bv = b.alignment_pct ?? -1;
          break;
        default:
          av = a.alignment_pct ?? -1;
          bv = b.alignment_pct ?? -1;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [allMembers, committee, party, search, sortKey, sortDir]);

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
      <h1
        className="text-3xl sm:text-5xl mb-1 text-[#111111] uppercase tracking-tight font-bold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Members
      </h1>
      <p className="text-sm text-stone-600 mb-6">
        Tax-writing committee members ranked by share of outside funding
      </p>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 uppercase tracking-[0.2em] mr-1" style={{ fontFamily: "var(--font-display)" }}>
            Committee
          </span>
          {COMMITTEES.map((c) => (
            <Pill key={c.value} active={committee === c.value} onClick={() => setCommittee(c.value)}>
              {c.label}
            </Pill>
          ))}
        </div>

        <div className="w-px h-6 bg-[#C8C1B6]/50" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 uppercase tracking-[0.2em] mr-1" style={{ fontFamily: "var(--font-display)" }}>
            Party
          </span>
          {PARTIES.map((p) => (
            <Pill key={p.value} active={party === p.value} onClick={() => setParty(p.value)}>
              {p.label}
            </Pill>
          ))}
        </div>

        <div className="w-px h-6 bg-[#C8C1B6]/50" />

        <input
          type="text"
          placeholder="Search member, state, employer..."
          aria-label="Search members"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-[#C8C1B6]/50 rounded-lg px-3 py-1.5 text-sm text-[#111111] placeholder-stone-400 focus:outline-none focus:border-[#FE4F40] w-64 transition-colors"
        />
      </div>

      <p className="text-xs text-stone-400 mb-3">
        {members.length} member{members.length !== 1 ? "s" : ""}
      </p>

      {members.length === 0 ? (
        <div className="border border-[#C8C1B6]/50 rounded-lg bg-white p-12 text-center">
          <p className="text-stone-600 text-sm">No members match the current filters.</p>
          <button
            onClick={() => { setCommittee("all"); setParty("all"); setSearch(""); }}
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
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500 w-12" style={{ fontFamily: "var(--font-display)" }}>#</th>
                  <ColHeader label="Member" sortField="member_name" />
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500 w-14" style={{ fontFamily: "var(--font-display)" }}>Party</th>
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>State-Dist</th>
                  <ColHeader label="Outside %" sortField="pct_outside" className="text-right" />
                  <ColHeader label="Alignment" sortField="alignment_pct" className="text-right" />
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>Top Sector</th>
                  <ColHeader label="Total $" sortField="total_itemized_amount" className="text-right" />
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>Top Funders Lobby For</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => {
                  const badge = partyBadge(m.party);
                  const href = `/members/${m.slug || toSlug(m.member_name)}`;
                  return (
                    <tr
                      key={m.slug || toSlug(m.member_name)}
                      role="link"
                      tabIndex={0}
                      aria-label={`View ${m.member_name}`}
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
                      className={`border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-[#FDFBF9]"}`}
                    >
                      <td className="px-3 py-2.5 text-xs text-stone-400">{i + 1}</td>
                      <td className="px-3 py-2.5 text-[#111111] font-medium whitespace-nowrap">{m.member_name}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wide font-bold" style={{ fontFamily: "var(--font-display)", backgroundColor: badge.bg, color: badge.text }}>{m.party}</span>
                      </td>
                      <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap">{stateDistrict(m)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: outsidePctColor(m.pct_outside) }}>{formatPct(m.pct_outside)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap"
                          style={{ color: (m.alignment_pct ?? 0) > 75 ? "#FE4F40" : (m.alignment_pct ?? 0) > 50 ? "#F59E0B" : "#4C6971" }}>
                        {m.alignment_pct != null ? `${m.alignment_pct.toFixed(0)}%` : "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-stone-600 whitespace-nowrap">
                        {m.top_funding_sector ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: sectorColor(m.top_funding_sector) }} />
                            {m.top_funding_sector}
                          </span>
                        ) : "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#111111] tabular-nums whitespace-nowrap">{formatMoney(m.total_itemized_amount)}</td>
                      <td className="px-3 py-2.5 text-stone-500 text-xs max-w-64">
                        <span className="line-clamp-2">{m.top_funder_agendas || "\u2014"}</span>
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
