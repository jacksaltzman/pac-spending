"use client";

import { useState } from "react";

interface OneLinerCopyProps {
  text: string;
  className?: string;
}

export default function OneLinerCopy({ text, className }: OneLinerCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!text) return null;

  return (
    <div className={`flex items-start gap-2 ${className || ""}`}>
      <p className="text-sm text-stone-600 italic flex-1 leading-relaxed">
        &ldquo;{text}&rdquo;
      </p>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 px-2 py-1 text-[10px] uppercase tracking-wider border border-[#C8C1B6]/50 rounded-sm text-stone-500 hover:text-[#111111] hover:border-[#C8C1B6] transition-colors"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
