"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface GeoBreakdownChartProps {
  inDistrict: number;
  inStateOutDistrict: number;
  dcKStreet: number;
  outOfState: number;
}

const GEO_COLORS = {
  inDistrict: "#4C6971",
  inState: "#7C9FA8",
  dcKStreet: "#F59E0B",
  outOfState: "#FE4F40",
};

export default function GeoBreakdownChart({
  inDistrict,
  inStateOutDistrict,
  dcKStreet,
  outOfState,
}: GeoBreakdownChartProps) {
  const data = [
    {
      label: "Average Member",
      inDistrict,
      inState: inStateOutDistrict,
      dcKStreet,
      outOfState,
    },
  ];

  return (
    <div>
      <div className="h-[80px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            barSize={40}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: "#78716c" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis type="category" dataKey="label" hide />
            <Tooltip
              formatter={((value: number, name: string) => {
                const labels: Record<string, string> = {
                  inDistrict: "In-District",
                  inState: "In-State (Outside District)",
                  dcKStreet: "DC / K-Street",
                  outOfState: "Out of State",
                };
                return [`${Number(value).toFixed(1)}%`, labels[name] || name];
              }) as never}
              contentStyle={{
                backgroundColor: "#111",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e7e5e4",
              }}
            />
            <Bar dataKey="inDistrict" stackId="geo" fill={GEO_COLORS.inDistrict} radius={[4, 0, 0, 4]} />
            <Bar dataKey="inState" stackId="geo" fill={GEO_COLORS.inState} />
            <Bar dataKey="dcKStreet" stackId="geo" fill={GEO_COLORS.dcKStreet} />
            <Bar dataKey="outOfState" stackId="geo" fill={GEO_COLORS.outOfState} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
        {[
          { label: "In-District", color: GEO_COLORS.inDistrict, pct: inDistrict },
          { label: "In-State", color: GEO_COLORS.inState, pct: inStateOutDistrict },
          { label: "DC / K-Street", color: GEO_COLORS.dcKStreet, pct: dcKStreet },
          { label: "Out of State", color: GEO_COLORS.outOfState, pct: outOfState },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs text-stone-600">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            {item.label}: <strong className="text-[#111111]">{item.pct.toFixed(0)}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
