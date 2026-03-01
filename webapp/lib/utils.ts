export function formatMoney(val: number | null | undefined): string {
  if (val == null || val === 0) return "$0";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "N/A";
  return `${val.toFixed(1)}%`;
}

export function memberSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function memberLabel(
  name: string,
  party: string,
  state: string,
  district?: number | null,
  chamber?: string
): string {
  const prefix = chamber === "senate" ? "Sen." : "Rep.";
  const distStr =
    chamber === "house" && district != null
      ? `-${String(district).padStart(2, "0")}`
      : "";
  return `${prefix} ${name} (${party}-${state}${distStr})`;
}

export function partyColor(party: string): string {
  if (party === "R") return "var(--color-republican)";
  if (party === "D" || party === "I") return "var(--color-democrat)";
  return "var(--color-text-secondary)";
}

export function geoClassColor(cls: string): string {
  switch (cls) {
    case "in_district":
    case "in_state":
      return "#22c55e";
    case "in_state_out_district":
      return "#86efac";
    case "dc_kstreet":
      return "#f59e0b";
    case "out_of_state":
      return "#ff4444";
    case "unknown":
      return "#555566";
    default:
      return "#8888a0";
  }
}

export function geoClassLabel(cls: string, chamber: string): string {
  switch (cls) {
    case "in_district":
      return "In-District";
    case "in_state":
      return "In-State";
    case "in_state_out_district":
      return "In-State, Out of District";
    case "dc_kstreet":
      return "DC / K-Street";
    case "out_of_state":
      return "Out of State";
    case "unknown":
      return "Unknown";
    default:
      return cls;
  }
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

const SECTOR_COLORS: Record<string, string> = {
  "Finance & Insurance": "#2563EB",
  "Healthcare & Pharma": "#DC2626",
  "Real Estate & Housing": "#16A34A",
  "Tech & Telecom": "#7C3AED",
  "Energy & Utilities": "#F59E0B",
  "Defense & Aerospace": "#6B7280",
  "Transportation": "#0891B2",
  "Retail & Consumer": "#EC4899",
  "Labor": "#EA580C",
  "Professional Services": "#4F46E5",
  "Food & Beverage": "#65A30D",
  "Construction & Engineering": "#A16207",
  "Ideological": "#BE185D",
  "Lobbying & Gov Relations": "#8B5CF6",
  "Other Industry": "#9CA3AF",
};

export function sectorColor(sector: string): string {
  return SECTOR_COLORS[sector] || "#9CA3AF";
}

/** Convert ALL-CAPS PAC name to Title Case, preserving common acronyms */
export function toTitleCase(str: string): string {
  const acronyms = new Set(["PAC", "LLC", "INC", "USA", "AFL", "CIO", "AFSCME", "UBS", "AT&T", "IBM", "NRECA"]);
  return str
    .split(" ")
    .map((word) => {
      if (acronyms.has(word)) return word;
      if (word.length <= 2) return word.toLowerCase();
      return word.charAt(0) + word.slice(1).toLowerCase();
    })
    .join(" ");
}
