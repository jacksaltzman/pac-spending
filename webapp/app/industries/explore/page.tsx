import {
  getPacSpread,
  getSectorColors,
  getNews,
  type PacSpreadEntry,
} from "@/lib/data";
import Link from "next/link";
import NewsCards from "@/components/NewsCard";
import PacsTable from "@/components/PacsTable";

export default function IndustriesExplorePage() {
  const pacs: PacSpreadEntry[] = getPacSpread();
  const sectorColors = getSectorColors();
  const news = getNews();

  if (!pacs || pacs.length === 0) return null;

  const sorted = [...pacs].sort(
    (a, b) => b.num_recipients - a.num_recipients
  );
  const topPacs = sorted.slice(0, 200);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <Link
          href="/industries"
          className="text-sm text-[#FE4F40] hover:underline mb-3 inline-block"
        >
          &larr; Back to The Industries
        </Link>
        <h1
          className="text-3xl sm:text-5xl text-[#111111] uppercase tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Explore All PACs
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed mt-3 max-w-2xl">
          Search, filter, and sort every PAC that funds tax-writing committee
          members. Each PAC is tagged by industry sector and shows how many of
          the 72 members it funds.
        </p>
      </header>

      {/* In the News */}
      {news.length > 0 && (
        <div className="mb-10">
          <NewsCards articles={news} sectorColors={sectorColors} />
        </div>
      )}

      {/* Interactive Table */}
      <PacsTable pacs={topPacs} sectorColors={sectorColors} />

      <p className="text-xs text-stone-400 mt-4">
        Showing top {topPacs.length} PACs (those funding 2+ committee members),
        sorted by number of recipients. Data from FEC bulk files, 2024 cycle.
      </p>
    </div>
  );
}
