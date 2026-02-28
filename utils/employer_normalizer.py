"""Employer name normalization for FEC contribution data."""

import json
import re
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import EMPLOYER_ALIASES_FILE

# Corporate suffixes to strip (order matters — longer matches first)
_SUFFIXES = [
    "CORPORATION", "INCORPORATED", "INTERNATIONAL", "ASSOCIATES",
    "CONSULTING", "MANAGEMENT", "TECHNOLOGIES", "ENTERPRISE",
    "HOLDINGS", "PARTNERS", "SERVICES", "COMPANY", "LIMITED",
    "GROUP", "CORP", "INC", "LLC", "LLP", "PLLC", "PC", "PA",
    "NA", "LP", "LTD", "CO", "PLC", "INTL", "ASSOC",
]

_SUFFIX_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(s) for s in _SUFFIXES) + r")\b",
    re.IGNORECASE,
)


def _load_aliases():
    """Load the employer alias table from config."""
    if EMPLOYER_ALIASES_FILE.exists():
        with open(EMPLOYER_ALIASES_FILE) as f:
            raw = json.load(f)
        # Build reverse lookup: variant -> canonical
        lookup = {}
        for canonical, variants in raw.items():
            canonical_upper = canonical.upper().strip()
            for variant in variants:
                lookup[variant.upper().strip()] = canonical_upper
        return lookup
    return {}


_ALIAS_LOOKUP = None


def _get_alias_lookup():
    global _ALIAS_LOOKUP
    if _ALIAS_LOOKUP is None:
        _ALIAS_LOOKUP = _load_aliases()
    return _ALIAS_LOOKUP


def reload_aliases():
    """Force reload of the alias table (call after editing the file)."""
    global _ALIAS_LOOKUP
    _ALIAS_LOOKUP = _load_aliases()


def normalize_employer(name):
    """Normalize a single employer name.

    Steps:
        1. Uppercase
        2. Strip whitespace
        3. Remove punctuation (periods, commas, decorative hyphens)
        4. Remove corporate suffixes
        5. Collapse multiple spaces
        6. Apply alias table

    Args:
        name: Raw employer string from FEC data

    Returns:
        Normalized employer string
    """
    if not name or not isinstance(name, str):
        return "UNKNOWN"

    # Uppercase and strip
    s = name.upper().strip()

    # Remove periods, commas, and isolated hyphens (keep hyphens in words like SELF-EMPLOYED)
    s = s.replace(".", "").replace(",", "")
    s = re.sub(r"\s+-\s+", " ", s)  # " - " -> " "

    # Remove corporate suffixes
    s = _SUFFIX_PATTERN.sub("", s)

    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()

    # Apply alias lookup
    aliases = _get_alias_lookup()
    if s in aliases:
        return aliases[s]

    # Check if the cleaned name matches after suffix removal
    # (e.g., "GOLDMAN SACHS" after stripping "& CO")
    s_no_amp = s.replace("&", "AND")
    if s_no_amp in aliases:
        return aliases[s_no_amp]

    return s if s else "UNKNOWN"
