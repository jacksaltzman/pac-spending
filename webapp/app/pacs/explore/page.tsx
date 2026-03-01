import {
  getPacSpread,
  getSectorColors,
  getNews,
  PacSpreadEntry,
} from "@/lib/data";
import NewsCards from "@/components/NewsCard";
import PacsTable from "../PacsTable";

export default function ExplorePage() {
  const pacs: PacSpreadEntry[] = getPacSpread();
  const sectorColors = getSectorColors();
  const news = getNews();

  if (!pacs || pacs.length === 0) return null;

  const sorted = [...pacs].sort(
    (a, b) => b.num_recipients - a.num_recipients
  );
  const topPacs = sorted.slice(0, 200);

  return (
    <div>
      {/* In the News */}
      {news.length > 0 && (
        <div className="mb-10">
          <NewsCards articles={news} sectorColors={sectorColors} />
        </div>
      )}

      {/* Interactive Table */}
      <PacsTable pacs={topPacs} sectorColors={sectorColors} />

      <p className="text-xs text-stone-400 mt-4">
        Showing top {topPacs.length} PACs (those funding 2+ committee
        members), sorted by number of recipients. Data from FEC bulk files,
        2024 cycle.
      </p>
    </div>
  );
}
