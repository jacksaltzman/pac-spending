interface GeoBreakdownChartProps {
  inDistrict: number;
  inStateOutDistrict: number;
  dcKStreet: number;
  outOfState: number;
  unknown?: number;
}

interface Segment {
  label: string;
  shortLabel: string;
  pct: number;
  color: string;
}

export default function GeoBreakdownChart({
  inDistrict,
  inStateOutDistrict,
  dcKStreet,
  outOfState,
  unknown = 0,
}: GeoBreakdownChartProps) {
  const knownTotal = inDistrict + inStateOutDistrict + dcKStreet + outOfState;
  const unknownPct = unknown > 0 ? unknown : Math.max(0, 100 - knownTotal);

  const segments: Segment[] = [
    { label: "In-District", shortLabel: "District", pct: inDistrict, color: "#4C6971" },
    { label: "In-State", shortLabel: "State", pct: inStateOutDistrict, color: "#7C9FA8" },
    { label: "DC / K-Street", shortLabel: "DC", pct: dcKStreet, color: "#F59E0B" },
    { label: "Out of State", shortLabel: "Out of State", pct: outOfState, color: "#FE4F40" },
    ...(unknownPct >= 0.5
      ? [{ label: "Unknown", shortLabel: "Other", pct: unknownPct, color: "#D6D3D1" }]
      : []),
  ];

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-10 sm:h-12 rounded-lg overflow-hidden">
        {segments.map((seg) =>
          seg.pct > 0 ? (
            <div
              key={seg.label}
              className="relative flex items-center justify-center overflow-hidden transition-all"
              style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
            >
              {seg.pct >= 8 && (
                <span className="text-white text-[11px] sm:text-xs font-semibold truncate px-1">
                  {Math.round(seg.pct)}%
                </span>
              )}
            </div>
          ) : null
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs text-stone-600">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="hidden sm:inline">{seg.label}:</span>
            <span className="sm:hidden">{seg.shortLabel}:</span>
            <strong className="text-[#111111]">{Math.round(seg.pct)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
