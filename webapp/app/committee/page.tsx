import Link from "next/link";
import { getMembers } from "@/lib/data";
import MembersTable from "@/components/MembersTable";

export default function CommitteePage() {
  const members = getMembers();

  /* ── Composition counts (exclude territorial + zero-amount) ──── */
  const active = members.filter(
    (m) => !m.is_territorial && m.total_itemized_amount > 0
  );

  const house = active.filter((m) => m.committee === "house_ways_and_means");
  const senate = active.filter((m) => m.committee === "senate_finance");

  const houseR = house.filter((m) => m.party === "R").length;
  const houseD = house.filter((m) => m.party === "D").length;
  const senateR = senate.filter((m) => m.party === "R").length;
  const senateD = senate.filter((m) => m.party === "D").length;

  return (
    <div>
      {/* ── Chapter heading ────────────────────────────────────── */}
      <p
        className="text-xs uppercase tracking-[0.25em] text-stone-400 mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Chapter 1
      </p>
      <h1
        className="text-3xl sm:text-5xl text-[#111111] uppercase tracking-tight font-bold mb-4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        The Committee
      </h1>

      {/* ── Narrative framing ──────────────────────────────────── */}
      <p className="text-sm text-stone-600 leading-relaxed max-w-2xl mb-8">
        Two congressional committees control federal tax policy. Every
        deduction, credit, and loophole passes through these {active.length}{" "}
        members. They decide who pays and who doesn&rsquo;t.
      </p>

      {/* ── Committee composition cards ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {/* House Ways & Means */}
        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
          <p
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            House Ways &amp; Means
          </p>
          <p className="text-3xl font-bold text-[#111111] tabular-nums mb-2">
            {house.length}
            <span className="text-sm font-normal text-stone-500 ml-2">
              members
            </span>
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span
                className="inline-block px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wide font-bold"
                style={{
                  fontFamily: "var(--font-display)",
                  backgroundColor: "#FEE2E2",
                  color: "#991B1B",
                }}
              >
                R
              </span>
              <span className="text-stone-600 tabular-nums">{houseR}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span
                className="inline-block px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wide font-bold"
                style={{
                  fontFamily: "var(--font-display)",
                  backgroundColor: "#DBEAFE",
                  color: "#1E40AF",
                }}
              >
                D
              </span>
              <span className="text-stone-600 tabular-nums">{houseD}</span>
            </span>
          </div>
        </div>

        {/* Senate Finance */}
        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
          <p
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Senate Finance
          </p>
          <p className="text-3xl font-bold text-[#111111] tabular-nums mb-2">
            {senate.length}
            <span className="text-sm font-normal text-stone-500 ml-2">
              members
            </span>
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span
                className="inline-block px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wide font-bold"
                style={{
                  fontFamily: "var(--font-display)",
                  backgroundColor: "#FEE2E2",
                  color: "#991B1B",
                }}
              >
                R
              </span>
              <span className="text-stone-600 tabular-nums">{senateR}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span
                className="inline-block px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wide font-bold"
                style={{
                  fontFamily: "var(--font-display)",
                  backgroundColor: "#DBEAFE",
                  color: "#1E40AF",
                }}
              >
                D
              </span>
              <span className="text-stone-600 tabular-nums">{senateD}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Members table ──────────────────────────────────────── */}
      <MembersTable members={members} />

      {/* ── Chapter transition CTA ─────────────────────────────── */}
      <div className="bg-[#111111] text-white rounded-lg p-6 mt-10">
        <p className="text-sm leading-relaxed mb-3">
          These members attract enormous outside money. Where does it come from?
        </p>
        <Link
          href="/money"
          className="text-[#FE4F40] text-sm font-semibold hover:underline underline-offset-2 transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Money &rarr;
        </Link>
      </div>
    </div>
  );
}
