"""Checkpoint/resume support for long-running pipeline steps."""

import json
import hashlib
from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import CHECKPOINT_DIR


def _checkpoint_path(step_name):
    return CHECKPOINT_DIR / f"{step_name}.json"


def save_checkpoint(step_name, data=None):
    """Mark a step as complete with optional metadata.

    Args:
        step_name: e.g., "00_download", "01_lookup_ids"
        data: Optional dict of metadata (row counts, file hashes, etc.)
    """
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    checkpoint = {
        "step": step_name,
        "completed_at": datetime.now().isoformat(),
        "data": data or {},
    }
    _checkpoint_path(step_name).write_text(json.dumps(checkpoint, indent=2))


def load_checkpoint(step_name):
    """Load checkpoint data for a step.

    Returns:
        Dict with checkpoint data, or None if no checkpoint exists.
    """
    path = _checkpoint_path(step_name)
    if path.exists():
        return json.loads(path.read_text())
    return None


def is_step_complete(step_name):
    """Check if a step has a completion checkpoint."""
    return _checkpoint_path(step_name).exists()


def clear_checkpoint(step_name):
    """Remove a step's checkpoint."""
    path = _checkpoint_path(step_name)
    if path.exists():
        path.unlink()


def clear_all_checkpoints():
    """Remove all checkpoints."""
    if CHECKPOINT_DIR.exists():
        for f in CHECKPOINT_DIR.glob("*.json"):
            f.unlink()


def file_hash(filepath, algorithm="md5"):
    """Compute a hash of a file for integrity checking."""
    h = hashlib.new(algorithm)
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def save_progress(step_name, key, value):
    """Save incremental progress within a step (e.g., last processed chunk).

    This is separate from step completion — it tracks mid-step state
    so a step can resume after interruption.
    """
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    progress_path = CHECKPOINT_DIR / f"{step_name}_progress.json"
    if progress_path.exists():
        progress = json.loads(progress_path.read_text())
    else:
        progress = {}
    progress[key] = value
    progress["updated_at"] = datetime.now().isoformat()
    progress_path.write_text(json.dumps(progress, indent=2))


def load_progress(step_name):
    """Load mid-step progress data.

    Returns:
        Dict with progress data, or empty dict.
    """
    progress_path = CHECKPOINT_DIR / f"{step_name}_progress.json"
    if progress_path.exists():
        return json.loads(progress_path.read_text())
    return {}
