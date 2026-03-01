import Link from "next/link";

interface MemberCardProps {
  name: string;
  slug: string;
  party: string;
  state: string;
  district: number | null;
  chamber: string;
  pctOutside: number;
  totalAmount: number;
  topEmployer?: string;
  rank?: number;
}

export default function MemberCard({
  name,
  slug,
  party,
  state,
  district,
  chamber,
  pctOutside,
  totalAmount,
  topEmployer,
  rank,
}: MemberCardProps) {
  const partyColor = party === "R" ? "#EF4444" : party === "D" ? "#3B82F6" : "#78716C";
  const partyBg = party === "R" ? "#FEE2E2" : party === "D" ? "#DBEAFE" : "#F5F5F4";
  const partyText = party === "R" ? "#991B1B" : party === "D" ? "#1E40AF" : "#44403C";
  const prefix = chamber === "senate" ? "Sen." : "Rep.";
  const distStr = chamber === "house" && district != null ? `-${String(district).padStart(2, "0")}` : "";
  const label = `${prefix} ${name}`;
  const location = `${party}-${state}${distStr}`;

  const formatMoney = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  };

  const outsideColor = pctOutside > 70 ? "#FE4F40" : pctOutside > 50 ? "#F59E0B" : "#4C6971";

  return (
    <Link
      href={`/members/${slug}`}
      className="block border-b border-stone-200 py-3 px-1 hover:bg-stone-50 transition-colors group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {rank != null && (
            <span className="w-8 h-8 rounded-sm bg-[#111111] text-white text-sm font-bold flex items-center justify-center" style={{ fontFamily: "var(--font-display)" }}>
              {rank}
            </span>
          )}
          <span className="text-sm font-medium text-[#111111] group-hover:text-[#FE4F40] transition-colors">
            {label}
          </span>
        </div>
        <span
          className="rounded-sm px-2.5 py-0.5 text-[10px] uppercase tracking-wide font-bold"
          style={{ fontFamily: "var(--font-display)", backgroundColor: partyBg, color: partyText }}
        >
          {location}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span
            className="text-2xl font-bold"
            style={{
              fontFamily: "var(--font-display)",
              color: outsideColor,
            }}
          >
            {pctOutside.toFixed(0)}%
          </span>
          <span className="text-xs text-stone-500 ml-1">outside</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-stone-600 font-medium">{formatMoney(totalAmount)}</p>
          {topEmployer && (
            <p className="text-[10px] text-stone-400 mt-0.5 max-w-32 truncate">{topEmployer}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
