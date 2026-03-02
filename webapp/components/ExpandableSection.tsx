"use client";

import { useState } from "react";

interface ExpandableSectionProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function ExpandableSection({
  label,
  children,
  defaultOpen = false,
}: ExpandableSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-[#FE4F40] cursor-pointer hover:underline transition-colors"
      >
        {open ? label.replace("Show", "Hide").replace("See", "Hide") : label}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
