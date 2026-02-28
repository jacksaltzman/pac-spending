#!/usr/bin/env python3
"""Step 00: Download FEC bulk data files and Census geographic reference data.

Downloads:
- Individual contribution files (indiv{yy}.zip) for 2024 and 2026 cycles
- PAC-to-candidate files (pas2{yy}.zip) for 2024 and 2026 cycles
- Census ZCTA-to-Congressional District relationship file
- ZIP-to-Congress mapping from GitHub

These are large files (indiv24.zip is ~1.5 GB). Downloads use streaming
with resume support — if interrupted, re-running will skip completed files.

Requires: ~15 GB free disk space.
"""

import sys
import zipfile
from pathlib import Path

import requests
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import (
    RAW_DIR, REFERENCE_DIR, BULK_URLS, CYCLES,
    CENSUS_ZCTA_CD_URLS, ZCCD_GITHUB_URL,
)
from utils.checkpoint import is_step_complete, save_checkpoint, save_progress, load_progress

STEP_NAME = "00_download_bulk_data"


def download_file(url, dest_path, description=None):
    """Download a file with progress bar and resume support.

    Skips download if file already exists and size matches the
    server's Content-Length header.

    Returns:
        True if file was downloaded or already exists, False on failure.
    """
    dest_path = Path(dest_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    label = description or dest_path.name

    # Check if already downloaded
    try:
        head = requests.head(url, timeout=15, allow_redirects=True)
        remote_size = int(head.headers.get("Content-Length", 0))
    except Exception:
        remote_size = 0

    if dest_path.exists():
        local_size = dest_path.stat().st_size
        if remote_size and local_size == remote_size:
            print(f"  [skip] {label} — already downloaded ({local_size:,} bytes)")
            return True
        elif local_size > 0 and remote_size == 0:
            # Can't verify size but file exists
            print(f"  [skip] {label} — exists ({local_size:,} bytes, can't verify)")
            return True

    print(f"  Downloading {label}...")
    try:
        resp = requests.get(url, stream=True, timeout=30)
        resp.raise_for_status()

        total = int(resp.headers.get("Content-Length", 0))
        with open(dest_path, "wb") as f:
            with tqdm(total=total, unit="B", unit_scale=True, desc=f"    {label}") as pbar:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))

        print(f"  Saved: {dest_path} ({dest_path.stat().st_size:,} bytes)")
        return True

    except Exception as e:
        print(f"  ERROR downloading {label}: {e}")
        return False


def extract_zip(zip_path, extract_to):
    """Extract a ZIP file, skipping if already extracted."""
    zip_path = Path(zip_path)
    extract_to = Path(extract_to)

    if not zip_path.exists():
        print(f"  [error] ZIP not found: {zip_path}")
        return False

    # Check if already extracted by looking for any .txt files
    existing = list(extract_to.glob("*.txt"))
    if existing:
        print(f"  [skip] Already extracted ({len(existing)} .txt files in {extract_to.name}/)")
        return True

    print(f"  Extracting {zip_path.name}...")
    extract_to.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_to)
    print(f"  Extracted to {extract_to}")
    return True


def run():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    REFERENCE_DIR.mkdir(parents=True, exist_ok=True)
    progress = load_progress(STEP_NAME)
    downloaded = set(progress.get("downloaded", []))
    failed = []

    # --- Download FEC bulk files ---
    for file_type, cycle_urls in BULK_URLS.items():
        for cycle, url in cycle_urls.items():
            if cycle not in CYCLES:
                continue
            filename = url.split("/")[-1]
            key = f"{file_type}_{cycle}"

            if key in downloaded:
                print(f"  [skip] {filename} — already processed")
                continue

            dest = RAW_DIR / filename
            desc = f"{file_type} {cycle} ({filename})"
            ok = download_file(url, dest, desc)

            if ok:
                # Extract into a subdirectory
                extract_dir = RAW_DIR / f"{file_type}_{cycle}"
                extract_zip(dest, extract_dir)
                downloaded.add(key)
                save_progress(STEP_NAME, "downloaded", list(downloaded))
            else:
                failed.append(desc)

    # --- Download Census ZCTA-to-CD file ---
    census_downloaded = False
    for url in CENSUS_ZCTA_CD_URLS:
        filename = url.split("/")[-1]
        dest = REFERENCE_DIR / filename
        if download_file(url, dest, f"Census ZCTA-CD ({filename})"):
            census_downloaded = True
            break
        else:
            print(f"  Census URL failed, trying fallback...")

    if not census_downloaded:
        print("  WARNING: Could not download Census ZCTA-CD file from any URL.")
        print("  The ZIP-to-district lookup will rely solely on the GitHub source.")

    # --- Download GitHub ZIP-to-Congress mapping ---
    zccd_dest = REFERENCE_DIR / "zccd.csv"
    if not download_file(ZCCD_GITHUB_URL, zccd_dest, "GitHub zccd.csv"):
        failed.append("zccd.csv")

    # --- Summary ---
    print(f"\n{'='*60}")
    print("Download Summary")
    print(f"{'='*60}")
    print(f"  Successfully processed: {len(downloaded)} bulk files")
    print(f"  Census ZCTA-CD: {'YES' if census_downloaded else 'NO'}")
    print(f"  GitHub zccd.csv: {'YES' if zccd_dest.exists() else 'NO'}")

    if failed:
        print(f"\n  FAILED ({len(failed)}):")
        for f in failed:
            print(f"    - {f}")

    # List what's in data/raw/
    print(f"\nFiles in {RAW_DIR}:")
    for p in sorted(RAW_DIR.rglob("*")):
        if p.is_file():
            size_mb = p.stat().st_size / (1024 * 1024)
            print(f"  {p.relative_to(RAW_DIR)} ({size_mb:.1f} MB)")

    save_checkpoint(STEP_NAME, {
        "downloaded": list(downloaded),
        "census_downloaded": census_downloaded,
        "failed": failed,
    })


if __name__ == "__main__":
    if "--force" in sys.argv:
        from utils.checkpoint import clear_checkpoint
        clear_checkpoint(STEP_NAME)
    run()
