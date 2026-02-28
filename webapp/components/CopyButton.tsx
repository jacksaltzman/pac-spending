"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="px-2 py-1 text-[10px] uppercase tracking-wider border border-[#C8C1B6]/50 rounded-sm text-stone-500 hover:text-[#111111] hover:border-[#C8C1B6] transition-colors"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
