interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
  smallValue?: boolean;
}

export default function StatCard({ label, value, detail, accent, smallValue }: StatCardProps) {
  return (
    <div className="border border-[#C8C1B6]/40 rounded-sm bg-white px-5 py-4">
      <p
        className="text-sm uppercase tracking-widest text-stone-600 mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {label}
      </p>
      <p
        className={`${smallValue ? "text-base" : "text-2xl"} font-bold tracking-tight`}
        style={{ fontFamily: "var(--font-display)", color: accent || "#111111" }}
      >
        {value}
      </p>
      {detail && (
        <p className="text-sm text-stone-600 mt-2">{detail}</p>
      )}
    </div>
  );
}
