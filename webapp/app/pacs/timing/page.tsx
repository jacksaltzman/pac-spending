import {
  getContributionTiming,
  getSectorColors,
} from "@/lib/data";
import TimingChart from "@/components/TimingChart";
import { buildTimingNarrative } from "../helpers";

export default function TimingPage() {
  const timing = getContributionTiming();
  const sectorColors = getSectorColors();

  if (!timing) {
    return (
      <div className="text-sm text-stone-500 py-10">
        Contribution timing data is not yet available. Run the pipeline to
        generate contribution_timing.json.
      </div>
    );
  }

  return (
    <div>
      <section className="space-y-4">
        <div>
          <p
            className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Contribution Timing
          </p>
          <h2
            className="text-2xl font-bold text-stone-900"
            style={{ fontFamily: "var(--font-display)" }}
          >
            When Does the Money Move?
          </h2>
        </div>
        <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
          {buildTimingNarrative(timing.event_analysis)}
        </p>
        <TimingChart timing={timing} sectorColors={sectorColors} />
        <p className="text-xs text-stone-500">
          Source: FEC bulk contribution data, 2024 election cycle. Legislative
          event dates from Congress.gov.
        </p>
      </section>
    </div>
  );
}
