import {
  getMembers,
  getCommitteeAggregates,
  getPacSpread,
  Member,
} from "@/lib/data";
import { formatMoney, formatPct } from "@/lib/utils";
import CopyButton from "@/components/CopyButton";
import EmptyState from "@/components/EmptyState";

interface StoryCard {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  copyText: string;
}

export default function StoriesPage() {
  const members = getMembers();
  const aggregates = getCommitteeAggregates();
  const pacs = getPacSpread();

  if (!members || members.length === 0) {
    return (
      <EmptyState
        title="No Data Available"
        message="Member data is not yet available. Run the pipeline to generate the dataset."
      />
    );
  }

  const stories: StoryCard[] = [];

  // --- a. High Outside Funding (>70%) ---
  const highOutside = members.filter((m) => m.pct_outside > 70);
  if (highOutside.length > 0) {
    const names = highOutside
      .sort((a, b) => b.pct_outside - a.pct_outside)
      .map(
        (m) =>
          `${m.member_name} (${m.party}-${m.state}): ${formatPct(m.pct_outside)} outside`
      );
    const summary = `${highOutside.length} member${highOutside.length === 1 ? "" : "s"} get >70% of funding from outside their district/state`;
    stories.push({
      id: "high-outside",
      title: summary,
      summary:
        "These members receive the overwhelming majority of their itemized individual contributions from outside their home area, raising questions about who they actually represent financially.",
      bullets: names,
      copyText: `${summary}\n\n${names.map((n) => `- ${n}`).join("\n")}`,
    });
  }

  // --- b. DC/K-Street Influence (>10%) ---
  const dcInfluence = members.filter((m) => m.pct_dc_kstreet > 10);
  if (dcInfluence.length > 0) {
    const names = dcInfluence
      .sort((a, b) => b.pct_dc_kstreet - a.pct_dc_kstreet)
      .map(
        (m) =>
          `${m.member_name} (${m.party}-${m.state}): ${formatPct(m.pct_dc_kstreet)} from DC`
      );
    const summary = `${dcInfluence.length} member${dcInfluence.length === 1 ? "" : "s"} get >10% from DC/K-Street`;
    stories.push({
      id: "dc-influence",
      title: summary,
      summary:
        "A significant share of these members' individual contributions come from the DC/K-Street corridor, suggesting heavy lobbyist and insider influence on the tax-writing committees.",
      bullets: names,
      copyText: `${summary}\n\n${names.map((n) => `- ${n}`).join("\n")}`,
    });
  }

  // --- c. Most Connected PACs (10+ recipients) ---
  const connectedPacs = pacs.filter((p) => p.num_recipients >= 10);
  if (connectedPacs.length > 0) {
    const sorted = [...connectedPacs].sort(
      (a, b) => b.num_recipients - a.num_recipients
    );
    const names = sorted.map(
      (p) =>
        `${p.pac_name}: ${p.num_recipients} members, ${formatMoney(p.total_given)} total`
    );
    const summary = `${connectedPacs.length} PAC${connectedPacs.length === 1 ? "" : "s"} fund 10+ committee members`;
    stories.push({
      id: "connected-pacs",
      title: summary,
      summary:
        "These PACs spread contributions across a large number of tax-writing committee members, maximizing their potential legislative influence.",
      bullets: names,
      copyText: `${summary}\n\n${names.map((n) => `- ${n}`).join("\n")}`,
    });
  }

  // --- d. Committee Comparison ---
  const houseAgg = aggregates.find(
    (a) => a.group === "House Ways & Means" || a.group === "house"
  );
  const senateAgg = aggregates.find(
    (a) => a.group === "Senate Finance" || a.group === "senate"
  );
  if (houseAgg && senateAgg) {
    const gap = Math.abs(
      houseAgg.median_pct_outside - senateAgg.median_pct_outside
    );
    if (gap > 5) {
      const higher =
        houseAgg.median_pct_outside > senateAgg.median_pct_outside
          ? "House Ways & Means"
          : "Senate Finance";
      const lower =
        higher === "House Ways & Means"
          ? "Senate Finance"
          : "House Ways & Means";
      const summary = `${higher} has ${gap.toFixed(1)}pp more outside funding than ${lower}`;
      const bullets = [
        `House W&M median outside %: ${formatPct(houseAgg.median_pct_outside)}`,
        `Senate Finance median outside %: ${formatPct(senateAgg.median_pct_outside)}`,
        `Gap: ${gap.toFixed(1)} percentage points`,
        `House highest: ${houseAgg.highest_outside_member} (${formatPct(houseAgg.highest_outside_pct)})`,
        `Senate highest: ${senateAgg.highest_outside_member} (${formatPct(senateAgg.highest_outside_pct)})`,
      ];
      stories.push({
        id: "committee-comparison",
        title: summary,
        summary:
          "The two chambers' tax-writing committees show meaningfully different geographic funding patterns, suggesting structural differences in how House and Senate members attract donors.",
        bullets,
        copyText: `${summary}\n\n${bullets.map((b) => `- ${b}`).join("\n")}`,
      });
    }
  }

  // --- e. Party Split ---
  const republicans = members.filter((m) => m.party === "R");
  const democrats = members.filter((m) => m.party === "D" || m.party === "I");

  function median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  if (republicans.length > 0 && democrats.length > 0) {
    const rMedian = median(republicans.map((m) => m.pct_outside));
    const dMedian = median(democrats.map((m) => m.pct_outside));
    const gap = Math.abs(rMedian - dMedian);
    if (gap > 5) {
      const higherParty = rMedian > dMedian ? "Republicans" : "Democrats";
      const lowerParty =
        higherParty === "Republicans" ? "Democrats" : "Republicans";
      const summary = `${higherParty} have ${gap.toFixed(1)}pp more outside funding than ${lowerParty}`;
      const bullets = [
        `Republican median outside %: ${formatPct(rMedian)} (${republicans.length} members)`,
        `Democrat median outside %: ${formatPct(dMedian)} (${democrats.length} members)`,
        `Gap: ${gap.toFixed(1)} percentage points`,
      ];
      stories.push({
        id: "party-split",
        title: summary,
        summary:
          "There is a notable partisan divide in geographic funding patterns on the tax-writing committees, with one party drawing significantly more from outside their home area.",
        bullets,
        copyText: `${summary}\n\n${bullets.map((b) => `- ${b}`).join("\n")}`,
      });
    }
  }

  // --- f. Most Local (<30% outside) ---
  const mostLocal = members.filter((m) => m.pct_outside < 30);
  if (mostLocal.length > 0) {
    const names = mostLocal
      .sort((a, b) => a.pct_outside - b.pct_outside)
      .map(
        (m) =>
          `${m.member_name} (${m.party}-${m.state}): ${formatPct(m.pct_outside)} outside`
      );
    const summary = `${mostLocal.length} member${mostLocal.length === 1 ? "" : "s"} are primarily locally funded (<30% outside)`;
    stories.push({
      id: "most-local",
      title: summary,
      summary:
        "These members stand out for raising the vast majority of their itemized contributions from within their own district or state.",
      bullets: names,
      copyText: `${summary}\n\n${names.map((n) => `- ${n}`).join("\n")}`,
    });
  }

  return (
    <div>
      <header className="mb-8">
        <h1
          className="text-3xl sm:text-5xl text-[#111111] mb-2 uppercase tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Story Hooks
        </h1>
        <p className="text-sm text-stone-600">
          Auto-generated findings and story angles from the data
        </p>
      </header>

      {stories.length === 0 ? (
        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-8 text-center">
          <p className="text-sm text-stone-600">
            No story hooks could be generated from the current dataset. This may
            mean the data lacks the variance needed for notable findings.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <p
            className="text-xs text-stone-500 uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {stories.length} story hook{stories.length === 1 ? "" : "s"}{" "}
            detected
          </p>

          {stories.map((story) => (
            <article
              key={story.id}
              className="bg-white border border-[#C8C1B6]/50 rounded-lg p-6"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="text-base font-semibold text-[#111111] leading-snug">
                  {story.title}
                </h2>
                <CopyButton text={story.copyText} />
              </div>

              <p className="text-sm text-stone-600 mb-4 leading-relaxed">
                {story.summary}
              </p>

              <ul className="space-y-1">
                {story.bullets.map((bullet, i) => (
                  <li
                    key={i}
                    className="text-xs text-stone-500 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[0.45rem] before:w-1 before:h-1 before:bg-[#FE4F40] before:rounded-full"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
