"""Rate-limited FEC API client."""

import time
import requests
import sys
import os

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from config.config import FEC_API_BASE, FEC_API_KEY, FEC_API_RATE_DELAY


class FECClient:
    """Simple FEC API client with rate limiting and retry logic."""

    def __init__(self, api_key=None):
        self.api_key = api_key or FEC_API_KEY
        self.base_url = FEC_API_BASE
        self.session = requests.Session()
        self._last_request_time = 0

    def _rate_limit(self):
        elapsed = time.time() - self._last_request_time
        if elapsed < FEC_API_RATE_DELAY:
            time.sleep(FEC_API_RATE_DELAY - elapsed)
        self._last_request_time = time.time()

    def get(self, endpoint, params=None, max_retries=5):
        """Make a GET request to the FEC API with rate limiting and retries.

        Args:
            endpoint: API path (e.g., "/candidates/search/")
            params: Query parameters (api_key is added automatically)
            max_retries: Number of retries on failure

        Returns:
            Parsed JSON response dict

        Raises:
            requests.HTTPError: After all retries exhausted
        """
        if params is None:
            params = {}
        params["api_key"] = self.api_key

        url = f"{self.base_url}{endpoint}"
        backoff = 1

        for attempt in range(max_retries):
            self._rate_limit()
            try:
                resp = self.session.get(url, params=params, timeout=30)
                if resp.status_code == 429:
                    wait = min(backoff * 2**attempt, 60)
                    print(f"  Rate limited. Waiting {wait}s...")
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.Timeout:
                print(f"  Timeout on attempt {attempt + 1}/{max_retries}")
                time.sleep(backoff * 2**attempt)
            except requests.exceptions.HTTPError as e:
                if attempt == max_retries - 1:
                    raise
                print(f"  HTTP error {e}. Retrying in {backoff * 2**attempt}s...")
                time.sleep(backoff * 2**attempt)

        raise RuntimeError(f"Failed after {max_retries} retries: {url}")

    def search_candidates(self, name, state, office, cycle=2024):
        """Search for a candidate by name, state, and office.

        Args:
            name: Candidate name
            state: Two-letter state code
            office: "H" for House, "S" for Senate
            cycle: Election cycle year

        Returns:
            List of candidate result dicts
        """
        params = {
            "name": name,
            "state": state,
            "office": office,
            "cycle": cycle,
            "per_page": 20,
        }
        data = self.get("/candidates/search/", params)
        return data.get("results", [])

    def get_candidate(self, candidate_id):
        """Get full candidate details including committees.

        Returns:
            Candidate dict with principal_committees
        """
        data = self.get(f"/candidate/{candidate_id}/")
        results = data.get("results", [])
        return results[0] if results else None

    def get_candidate_committees(self, candidate_id, cycle=2024):
        """Get all committees affiliated with a candidate for a cycle.

        Returns:
            List of committee dicts
        """
        params = {"cycle": cycle, "per_page": 100}
        data = self.get(f"/candidate/{candidate_id}/committees/", params)
        return data.get("results", [])

    def get_candidate_totals(self, candidate_id, cycle=2024):
        """Get financial summary totals for a candidate.

        Returns:
            Dict with receipts, individual_itemized_contributions, etc.
        """
        params = {"cycle": cycle}
        data = self.get(f"/candidate/{candidate_id}/totals/", params)
        results = data.get("results", [])
        return results[0] if results else None
