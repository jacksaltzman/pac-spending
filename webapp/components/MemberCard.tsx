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
  rank,
}: MemberCardProps) {
  const partyBg = party === "R" ? "#FEE2E2" : party === "D" ? "#DBEAFE" : "#F5F5F4";
  const partyText = party === "R" ? "#991B1B" : party === "D" ? "#1E40AF" : "#44403C";
  const prefix = chamber === "senate" ? "Sen." : "Rep.";
  const distStr = chamber === "house" && district != null ? `-${String(district).padStart(2, "0")}` : "";
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
      className="flex items-center border-b border-stone-200 py-2 px-1 hover:bg-stone-50 transition-colors group gap-2"
    >
      {rank != null && (
        <span
          className="text-xs text-stone-400 w-6 shrink-0 tabular-nums"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {rank}.
        </span>
      )}

      <span className="text-sm font-medium text-[#111111] group-hover:text-[#FE4F40] transition-colors truncate">
        {prefix} {name}
      </span>

      <span
        className="rounded-sm px-1.5 py-px text-[10px] uppercase tracking-wide font-bold shrink-0"
        style={{ fontFamily: "var(--font-display)", backgroundColor: partyBg, color: partyText }}
      >
        {location}
      </span>

      <span className="ml-auto flex items-center gap-3 shrink-0">
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ fontFamily: "var(--font-display)", color: outsideColor }}
        >
          {pctOutside.toFixed(0)}%
        </span>
        <span className="text-xs text-stone-500 tabular-nums w-16 text-right">
          {formatMoney(totalAmount)}
        </span>
      </span>
    </Link>
  );
}
