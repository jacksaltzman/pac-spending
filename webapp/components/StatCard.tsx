interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
}

export default function StatCard({ label, value, detail, accent }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-[#C8C1B6]/50 p-5">
      <p
        className="text-xs uppercase tracking-widest text-stone-600 mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-display)", color: accent || "#111111" }}
      >
        {value}
      </p>
      {detail && (
        <p className="text-xs text-stone-500 mt-2">{detail}</p>
      )}
    </div>
  );
}
