import type { Member } from "@/lib/data";

interface GeoStripChartProps {
  members: Member[];
}

const GEO_COLORS = {
  inDistrict: "#4C6971",
  inState: "#7C9FA8",
  dc: "#F59E0B",
  outOfState: "#FE4F40",
};

export default function GeoStripChart({ members }: GeoStripChartProps) {
  const sorted = [...members]
    .filter((m) => !m.is_territorial && m.total_itemized_amount > 0)
    .sort((a, b) => b.pct_outside - a.pct_outside);

  if (sorted.length === 0) return null;

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-4 mb-3 text-[10px] text-stone-500">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-1.5" style={{ backgroundColor: GEO_COLORS.inDistrict }} />
          In-District
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-1.5" style={{ backgroundColor: GEO_COLORS.inState }} />
          In-State
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-1.5" style={{ backgroundColor: GEO_COLORS.dc }} />
          DC/K-Street
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-1.5" style={{ backgroundColor: GEO_COLORS.outOfState }} />
          Out of State
        </span>
      </div>

      {/* Strip rows */}
      <div className="space-y-px">
        {sorted.map((m) => {
          const prefix = m.chamber === "senate" ? "Sen." : "Rep.";
          const pctColor =
            m.pct_outside > 70 ? "#FE4F40" : m.pct_outside > 50 ? "#F59E0B" : "#4C6971";

          return (
            <div key={m.slug} className="flex items-center gap-2 group">
              {/* Name */}
              <div className="w-36 flex-shrink-0 text-right pr-1">
                <span className="text-[10px] text-stone-500 group-hover:text-stone-800 transition-colors truncate block">
                  {prefix} {m.member_name}
                </span>
              </div>

              {/* Party indicator */}
              <span
                className="w-1.5 h-3 flex-shrink-0"
                style={{
                  backgroundColor: m.party === "R" ? "#EF4444" : m.party === "D" ? "#3B82F6" : "#78716C",
                }}
              />

              {/* Stacked bar */}
              <div className="flex-1 flex h-3 overflow-hidden">
                {m.pct_in_district > 0 && (
                  <div
                    style={{
                      width: `${m.pct_in_district}%`,
                      backgroundColor: GEO_COLORS.inDistrict,
                    }}
                  />
                )}
                {m.pct_in_state_out_district > 0 && (
                  <div
                    style={{
                      width: `${m.pct_in_state_out_district}%`,
                      backgroundColor: GEO_COLORS.inState,
                    }}
                  />
                )}
                {m.pct_dc_kstreet > 0 && (
                  <div
                    style={{
                      width: `${m.pct_dc_kstreet}%`,
                      backgroundColor: GEO_COLORS.dc,
                    }}
                  />
                )}
                {m.pct_out_of_state > 0 && (
                  <div
                    style={{
                      width: `${m.pct_out_of_state}%`,
                      backgroundColor: GEO_COLORS.outOfState,
                    }}
                  />
                )}
              </div>

              {/* Outside % */}
              <span
                className="w-10 text-right text-[10px] font-semibold tabular-nums flex-shrink-0"
                style={{ color: pctColor }}
              >
                {m.pct_outside.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
