"use client";

import { useState } from "react";

interface ExpandableTableProps {
  rows: React.ReactNode[];
  initialCount?: number;
  totalLabel?: string;
}

export default function ExpandableTable({
  rows,
  initialCount = 10,
  totalLabel = "rows",
}: ExpandableTableProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, initialCount);
  const hasMore = rows.length > initialCount;

  return (
    <>
      {visible}
      {hasMore && (
        <tr>
          <td colSpan={100} className="text-center py-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-[#4C6971] hover:text-[#111111] transition-colors underline underline-offset-2"
            >
              {expanded
                ? "Show less"
                : `Show all ${rows.length} ${totalLabel}`}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
