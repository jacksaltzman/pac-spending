import os
from pathlib import Path

# --- Project paths ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
REFERENCE_DIR = DATA_DIR / "reference"
CHECKPOINT_DIR = DATA_DIR / "checkpoints"
OUTPUT_DIR = PROJECT_ROOT / "output"

MEMBERS_FILE = CONFIG_DIR / "members.json"
EMPLOYER_ALIASES_FILE = CONFIG_DIR / "employer_aliases.json"

# --- FEC API ---
FEC_API_KEY = os.environ.get("FEC_API_KEY", "DEMO_KEY")
FEC_API_BASE = "https://api.open.fec.gov/v1"
FEC_API_RATE_DELAY = 1.0  # seconds between API calls

# --- Cycles ---
PRIMARY_CYCLE = 2024  # Complete data
SECONDARY_CYCLE = 2026  # Partial / in-progress
CYCLES = [PRIMARY_CYCLE, SECONDARY_CYCLE]

# --- FEC Bulk Download URLs ---
BULK_URLS = {
    # Individual contributions (Schedule A)
    "indiv": {
        2024: "https://www.fec.gov/files/bulk-downloads/2024/indiv24.zip",
        2026: "https://www.fec.gov/files/bulk-downloads/2026/indiv26.zip",
    },
    # PAC-to-candidate contributions
    "pas2": {
        2024: "https://www.fec.gov/files/bulk-downloads/2024/pas224.zip",
        2026: "https://www.fec.gov/files/bulk-downloads/2026/pas226.zip",
    },
    # Committee master file
    "cm": {
        2024: "https://www.fec.gov/files/bulk-downloads/2024/cm24.zip",
        2026: "https://www.fec.gov/files/bulk-downloads/2026/cm26.zip",
    },
    # Candidate master file
    "cn": {
        2024: "https://www.fec.gov/files/bulk-downloads/2024/cn24.zip",
        2026: "https://www.fec.gov/files/bulk-downloads/2026/cn26.zip",
    },
}

# --- Census / Geographic Reference ---
CENSUS_ZCTA_CD_URLS = [
    # Try 119th Congress first, fall back to 118th
    "https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_cd11920_zcta520_natl.txt",
    "https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_cd11820_zcta520_natl.txt",
]
ZCCD_GITHUB_URL = "https://raw.githubusercontent.com/OpenSourceActivismTech/us-zipcodes-congress/master/zccd.csv"

# --- FEC Bulk File Column Definitions ---
# Individual contributions (itcont.txt) — pipe-delimited, no header
INDIV_COLUMNS = [
    "CMTE_ID", "AMNDT_IND", "RPT_TP", "TRANSACTION_PGI", "IMAGE_NUM",
    "TRANSACTION_TP", "ENTITY_TP", "NAME", "CITY", "STATE",
    "ZIP_CODE", "EMPLOYER", "OCCUPATION", "TRANSACTION_DT",
    "TRANSACTION_AMT", "OTHER_ID", "TRAN_ID", "FILE_NUM",
    "MEMO_CD", "MEMO_TEXT", "SUB_ID",
]

# Columns we actually need from the individual contributions file
INDIV_USECOLS = [
    "CMTE_ID", "NAME", "CITY", "STATE", "ZIP_CODE",
    "EMPLOYER", "OCCUPATION", "TRANSACTION_DT", "TRANSACTION_AMT",
    "MEMO_CD", "MEMO_TEXT", "TRANSACTION_TP", "SUB_ID",
]

# PAC-to-candidate contributions (itpas2.txt) — pipe-delimited, no header
PAS2_COLUMNS = [
    "CMTE_ID", "AMNDT_IND", "RPT_TP", "TRANSACTION_PGI", "IMAGE_NUM",
    "TRANSACTION_TP", "ENTITY_TP", "NAME", "CITY", "STATE",
    "ZIP_CODE", "EMPLOYER", "OCCUPATION", "TRANSACTION_DT",
    "TRANSACTION_AMT", "OTHER_ID", "CAND_ID", "TRAN_ID",
    "FILE_NUM", "MEMO_CD", "MEMO_TEXT", "SUB_ID",
]

PAS2_USECOLS = [
    "CMTE_ID", "NAME", "TRANSACTION_AMT", "TRANSACTION_DT",
    "CAND_ID", "MEMO_CD", "MEMO_TEXT",
]

# Committee master file (cm.txt) — pipe-delimited, no header
CM_COLUMNS = [
    "CMTE_ID", "CMTE_NM", "TRES_NM", "CMTE_ST1", "CMTE_ST2",
    "CMTE_CITY", "CMTE_ST", "CMTE_ZIP", "CMTE_DSGN", "CMTE_TP",
    "CMTE_PTY_AFFILIATION", "CMTE_FILING_FREQ", "ORG_TP",
    "CONNECTED_ORG_NM", "CAND_ID",
]

CM_USECOLS = ["CMTE_ID", "CMTE_NM", "CMTE_DSGN", "CMTE_TP", "CONNECTED_ORG_NM"]

# --- DC / K-Street ZIP Prefixes ---
DC_ZIP_PREFIXES = ("200", "201", "202", "203", "204", "205")

# --- ActBlue / WinRed Committee IDs ---
ACTBLUE_CMTE_ID = "C00401224"
WINRED_CMTE_ID = "C00694323"

# --- Chunk size for reading bulk files ---
BULK_CHUNK_SIZE = 500_000
