"use client";

import { useState, type ReactNode } from "react";

type Tab = {
  id: string;
  label: string;
};

const TABS: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "funding", label: "Funding Sources" },
  { id: "votes", label: "Votes & Context" },
];

interface MemberTabsProps {
  overviewContent: ReactNode;
  fundingContent: ReactNode;
  votesContent: ReactNode;
}

export default function MemberTabs({
  overviewContent,
  fundingContent,
  votesContent,
}: MemberTabsProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const panels: Record<string, ReactNode> = {
    overview: overviewContent,
    funding: fundingContent,
    votes: votesContent,
  };

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[#C8C1B6]/50 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs uppercase tracking-[0.15em] transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "border-b-2 border-[#FE4F40] text-[#111111] font-bold"
                : "border-b-2 border-transparent text-stone-400 hover:text-[#111111]"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div>{panels[activeTab]}</div>
    </div>
  );
}
