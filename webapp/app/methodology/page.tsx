import { getMembers, getBenchmarks } from "@/lib/data";

export default function MethodologyPage() {
  const members = getMembers();
  const benchmarks = getBenchmarks();

  const totalMembers = members.length;
  const houseCount = members.filter((m) => m.chamber === "house").length;
  const senateCount = members.filter((m) => m.chamber === "senate").length;

  return (
    <div className="max-w-4xl">
      <header className="mb-10">
        <h1
          className="text-3xl sm:text-5xl text-[#111111] mb-2 uppercase tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Methodology &amp; Sources
        </h1>
        <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
          Every number on this site is derived from publicly available federal
          data. This page explains what we measure, how we measure it, and where
          the data comes from &mdash; so you can verify it yourself.
        </p>
      </header>

      <div className="space-y-10">
        {/* Data Sources */}
        <Section title="Data Sources">
          <p>
            All contribution data comes from the{" "}
            <ExtLink href="https://www.fec.gov/data/browse-data/?tab=bulk-data">
              Federal Election Commission (FEC) bulk data files
            </ExtLink>{" "}
            for the <strong>2024 election cycle</strong> (covering contributions
            from January 2023 through December 2024).
          </p>
          <dl className="mt-4 space-y-3">
            <DataRow
              term="Individual contributions"
              detail="FEC Form 3/3P Schedule A (itcont files) — 877,369 itemized transactions totaling $103.3M"
            />
            <DataRow
              term="PAC contributions"
              detail="FEC Form 3P Schedule B (pas2 files) — 64,242 transactions totaling $109.8M to target committee members"
            />
            <DataRow
              term="Committee master"
              detail="FEC cm.txt — maps committee IDs to real PAC names, types, and connected organizations"
            />
            <DataRow
              term="Candidate data"
              detail="FEC candidate files + API lookups — links candidate IDs to member names and principal committees"
            />
            <DataRow
              term="All-candidates summary"
              detail="FEC webl24.txt — used for benchmark comparisons (committee members vs. all incumbents)"
            />
            <DataRow
              term="Geographic data"
              detail="U.S. Census Bureau ZIP-to-congressional-district crosswalk (ZCTA relationship file)"
            />
            <DataRow
              term="Legislative events"
              detail="Congress.gov bill actions and committee schedules — 21 curated events for contribution timing analysis"
            />
          </dl>
        </Section>

        {/* Who We Track */}
        <Section title="Who We Track">
          <p>
            This analysis covers <strong>{totalMembers} members</strong> of the
            two congressional committees that control federal tax policy:
          </p>
          <ul className="mt-3 space-y-2">
            <li className="flex gap-3">
              <span className="text-[#FE4F40] font-bold mt-0.5">&#9632;</span>
              <span>
                <strong>House Ways &amp; Means Committee</strong> &mdash;{" "}
                {houseCount} members (118th Congress)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4C6971] font-bold mt-0.5">&#9632;</span>
              <span>
                <strong>Senate Finance Committee</strong> &mdash;{" "}
                {senateCount} members (118th Congress)
              </span>
            </li>
          </ul>
          <p className="mt-3">
            A small number of members could not be matched to FEC candidate
            records via the API (e.g., Mike Kelly, Beth Van Duyne) and are
            excluded from the analysis. This is a known limitation of FEC name
            matching.
          </p>
        </Section>

        {/* Geographic Classification */}
        <Section title="Geographic Classification">
          <p>
            The core question this project answers is: <em>where does the
            money come from?</em> Every itemized individual contribution is
            classified into one of six geographic categories based on the
            donor&apos;s ZIP code:
          </p>
          <dl className="mt-4 space-y-3">
            <DataRow
              term="In-district"
              detail="Donor's ZIP code falls within the member's congressional district (House only). Uses Census ZCTA-to-CD crosswalk."
            />
            <DataRow
              term="In-state, out-of-district"
              detail="Donor is in the member's state but outside their district (House only)."
            />
            <DataRow
              term="In-state"
              detail="Donor is in the member's state (Senate members, or combined House metric)."
            />
            <DataRow
              term="DC / K-Street"
              detail="Donor's ZIP code is in the District of Columbia (ZIP codes 200xx). This captures lobbyist and political professional contributions."
            />
            <DataRow
              term="Out-of-state"
              detail="Donor is outside the member's state and not in DC."
            />
            <DataRow
              term="Unknown"
              detail="ZIP code is missing, malformed, or cannot be mapped to a congressional district. Typically <1% of records."
            />
          </dl>
          <Callout>
            ZIP-to-district mapping is approximate. Some ZIP codes span
            multiple congressional districts. In these cases, we use the
            Census Bureau&apos;s population-weighted assignment to the most
            likely district. This affects a small percentage of
            classifications.
          </Callout>
        </Section>

        {/* PAC Sector Classification */}
        <Section title="PAC Industry Classification">
          <p>
            PAC contributions are classified by industry sector using a
            two-tiered system:
          </p>
          <ol className="mt-3 space-y-2 list-decimal list-inside">
            <li>
              <strong>Curated mappings</strong> &mdash; 80 of the most active
              PACs are manually mapped to one of 14 industry sectors, each
              with a description of their tax policy agenda. These cover the
              vast majority of PAC dollars flowing to committee members.
            </li>
            <li>
              <strong>Keyword fallback</strong> &mdash; Remaining PACs are
              classified by matching their name or connected organization
              against sector-specific keywords. PACs that don&apos;t match any
              sector are labeled &ldquo;Other/Unclassified.&rdquo;
            </li>
          </ol>
          <p className="mt-3">
            The 14 sectors are: Finance &amp; Insurance, Healthcare &amp; Pharma,
            Real Estate &amp; Housing, Tech &amp; Telecom, Energy &amp; Utilities,
            Defense &amp; Aerospace, Transportation, Retail &amp; Consumer,
            Labor, Professional Services, Food &amp; Beverage, Construction
            &amp; Engineering, Ideological, and Other Industry.
          </p>
          <Callout>
            Sector assignments are editorial judgments. We consulted{" "}
            <ExtLink href="https://www.opensecrets.org">OpenSecrets</ExtLink>{" "}
            classifications where available, but some PACs span multiple
            industries. We classify based on the PAC&apos;s primary tax policy
            interest, not its broadest business activity.
          </Callout>
        </Section>

        {/* PAC Name Resolution */}
        <Section title="PAC Name Resolution">
          <p>
            A critical technical detail: the <code>NAME</code> field in FEC
            bulk PAC contribution data (pas2 files) is <em>not</em> the
            PAC&apos;s own name &mdash; it&apos;s a payee, vendor, or conduit
            name. To get the real PAC identity, we join each transaction&apos;s{" "}
            <code>CMTE_ID</code> against the FEC committee master file
            (<code>cm.txt</code>), which provides the actual committee name,
            type, designation, and connected organization.
          </p>
          <p className="mt-2">
            Without this step, PAC analysis would be meaningless &mdash; you&apos;d
            see vendor names instead of the organizations actually directing
            the money.
          </p>
        </Section>

        {/* Benchmarks */}
        {benchmarks && (
          <Section title="Benchmark Methodology">
            <p>
              The &ldquo;Do Tax-Writers Get More PAC Money?&rdquo;
              comparison on the PACs page uses the FEC all-candidates summary
              file (<code>webl24.txt</code>) to compare median PAC receipts
              for committee members against all House/Senate incumbents.
            </p>
            <dl className="mt-4 space-y-3">
              <DataRow
                term="House comparison"
                detail={`${benchmarks.house.committee.count} Ways & Means members vs. ${benchmarks.house.all_incumbents.count} House incumbents (median PAC receipts)`}
              />
              <DataRow
                term="Senate comparison"
                detail="Less reliable due to off-cycle fundraising. Senators not up for re-election in 2024 show artificially low totals. Noted in the UI."
              />
            </dl>
          </Section>
        )}

        {/* Contribution Timing */}
        <Section title="Contribution Timing Analysis">
          <p>
            The timing analysis tests whether PAC contributions spike around
            legislative events. For each of 21 curated events (committee
            markups, floor votes, hearings), we compute:
          </p>
          <dl className="mt-4 space-y-3">
            <DataRow
              term="Baseline"
              detail="Average weekly PAC contributions 90-30 days before the event"
            />
            <DataRow
              term="Event week"
              detail="Total PAC contributions in the ISO week (Monday-Sunday) containing the event"
            />
            <DataRow
              term="Spike ratio"
              detail="Event week total / baseline weekly average. A ratio of 2.0x means contributions were double the normal rate."
            />
            <DataRow
              term="Sector specificity"
              detail="We test whether industries directly affected by the legislation spike more than unrelated sectors. This distinguishes targeted timing from coincidence."
            />
          </dl>
        </Section>

        {/* Validation */}
        <Section title="Data Validation">
          <p>
            We cross-check our processed totals against the FEC API&apos;s
            reported figures for each member. Key validation metrics:
          </p>
          <dl className="mt-4 space-y-3">
            <DataRow
              term="Capture rate"
              detail="Our itemized total / FEC reported itemized total. Median capture rate across validated members: 100.3% (range: 96.1%–103.8%). Minor discrepancies are normal due to FEC data processing lag and amendment filings."
            />
            <DataRow
              term="Discrepancy threshold"
              detail="Members with >5% discrepancy are flagged in the validation report. This has not occurred in the current dataset."
            />
            <DataRow
              term="Unitemized contributions"
              detail="Contributions under $200 are not individually reported to the FEC and are excluded from our geographic analysis. For most members, unitemized contributions are <15% of total receipts. Seven members exceed 30% — their geographic breakdowns may be less representative."
            />
          </dl>
          <Callout>
            This analysis only covers <strong>itemized</strong> individual
            contributions ($200+) and PAC contributions. It does not include
            unitemized small-dollar donations, transfers between committees,
            candidate self-funding, or in-kind contributions. The geographic
            breakdown reflects where large-dollar donors live, not the full
            donor base.
          </Callout>
        </Section>

        {/* Known Limitations */}
        <Section title="Known Limitations">
          <ul className="space-y-3">
            <Limitation>
              <strong>Unitemized gap:</strong> Small-dollar donors (&lt;$200)
              are invisible in FEC itemized data. Members with large
              grassroots bases (e.g., Elizabeth Warren, Bernie Sanders) may
              appear more &ldquo;outside-funded&rdquo; than they are because
              their local small-dollar donors aren&apos;t counted.
            </Limitation>
            <Limitation>
              <strong>ZIP-to-district approximation:</strong> Some ZIP codes
              cross district boundaries. A small percentage of
              &ldquo;in-district&rdquo; classifications may be incorrect.
            </Limitation>
            <Limitation>
              <strong>Senate off-cycle fundraising:</strong> Senators not up
              for re-election in 2024 show lower totals. The Senate benchmark
              comparison is noted as less reliable.
            </Limitation>
            <Limitation>
              <strong>Missing members:</strong> A few committee members
              could not be matched to FEC records and are excluded entirely.
            </Limitation>
            <Limitation>
              <strong>PAC sector classification:</strong> Keyword-based
              fallback classification is imperfect. Some PACs may be
              misclassified or left as &ldquo;unclassified.&rdquo;
            </Limitation>
            <Limitation>
              <strong>Conduit contributions:</strong> Some contributions are
              flagged as conduit/earmarked (ActBlue, WinRed). These are
              counted at the destination, not the intermediary, but
              geographic classification uses the original donor&apos;s address.
            </Limitation>
          </ul>
        </Section>

        {/* Reproduce */}
        <Section title="Reproduce This Analysis">
          <p>
            This project is designed to be fully reproducible. The data
            pipeline is open source and can be re-run with a free FEC API key.
          </p>
          <ol className="mt-4 space-y-2 list-decimal list-inside text-sm">
            <li>
              Get a free API key from{" "}
              <ExtLink href="https://api.open.fec.gov/developers/">
                api.open.fec.gov
              </ExtLink>
            </li>
            <li>
              Download the FEC bulk data files for the 2024 cycle from{" "}
              <ExtLink href="https://www.fec.gov/data/browse-data/?tab=bulk-data">
                fec.gov/data/browse-data
              </ExtLink>
            </li>
            <li>
              Run the 10-step Python pipeline:{" "}
              <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">
                python scripts/run_all.py
              </code>
            </li>
            <li>
              Review the validation report at{" "}
              <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">
                output/validation_reconciliation.csv
              </code>
            </li>
          </ol>
          <p className="mt-3">
            Discrepancies between our numbers and other analyses of the same
            FEC data are most likely due to differences in cycle definition,
            treatment of refunds/amendments, or inclusion of non-itemized
            contributions. We welcome corrections.
          </p>
        </Section>

        {/* Editorial Note */}
        <Section title="Editorial Approach">
          <p>
            This project is <strong>investigative, not partisan</strong>. The
            analysis covers both parties equally and lets the data speak. Where
            interpretive framing is used (chart captions, section
            introductions), it is clearly distinguished from the underlying
            data. All narrative claims are derived from computed metrics, not
            hardcoded.
          </p>
          <p className="mt-2">
            The goal is accountability through transparency: showing voters
            and journalists which interests are funding the people who decide
            who pays taxes and who doesn&apos;t.
          </p>
        </Section>
      </div>
    </div>
  );
}

/* ── Reusable sub-components (local to this file) ────────── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="text-lg font-bold text-[#111111] mb-3 uppercase tracking-wide"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      <div className="text-sm text-stone-700 leading-relaxed">{children}</div>
    </section>
  );
}

function DataRow({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex gap-3">
      <dt className="font-semibold text-[#111111] min-w-[140px] sm:min-w-[180px] flex-shrink-0 text-sm">
        {term}
      </dt>
      <dd className="text-sm text-stone-600">{detail}</dd>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 border-l-4 border-[#F59E0B] bg-[#FFFBEB] rounded-r-lg px-4 py-3 text-xs text-stone-700 leading-relaxed">
      {children}
    </div>
  );
}

function Limitation({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm text-stone-600 pl-3 relative">
      <span className="absolute left-0 top-[0.5rem] w-1.5 h-1.5 bg-[#F59E0B] rounded-full" />
      {children}
    </li>
  );
}

function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#4C6971] underline underline-offset-2 hover:text-[#111111] transition-colors"
    >
      {children}
    </a>
  );
}
