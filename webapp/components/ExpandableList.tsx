"use client";

import { useState } from "react";

interface ExpandableListProps {
  items: React.ReactNode[];
  initialCount?: number;
  totalLabel?: string;
}

export default function ExpandableList({
  items,
  initialCount = 5,
  totalLabel = "items",
}: ExpandableListProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialCount);
  const hasMore = items.length > initialCount;

  return (
    <>
      {visible}
      {hasMore && (
        <div className="text-center py-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#4C6971] hover:text-[#111111] transition-colors underline underline-offset-2 cursor-pointer"
          >
            {expanded
              ? "Show less"
              : `Show all ${items.length} ${totalLabel} \u2192`}
          </button>
        </div>
      )}
    </>
  );
}
