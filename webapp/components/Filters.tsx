"use client";

interface FiltersProps {
  committee: string;
  setCommittee: (v: string) => void;
  party: string;
  setParty: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
}

const COMMITTEES = [
  { value: "all", label: "All" },
  { value: "house_ways_and_means", label: "House W&M" },
  { value: "senate_finance", label: "Senate Finance" },
];

const PARTIES = [
  { value: "all", label: "All" },
  { value: "R", label: "Republican" },
  { value: "D", label: "Democrat" },
];

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

export default function Filters({
  committee,
  setCommittee,
  party,
  setParty,
  search,
  setSearch,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      <div className="flex items-center gap-2">
        <span
          className="text-xs text-stone-500 uppercase tracking-[0.2em] mr-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
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
        <span
          className="text-xs text-stone-500 uppercase tracking-[0.2em] mr-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
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
        placeholder="Search member..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-white border border-[#C8C1B6]/50 rounded-lg px-3 py-1.5 text-sm text-[#111111] placeholder-stone-400 focus:outline-none focus:border-[#FE4F40] w-56 transition-colors"
      />
    </div>
  );
}
