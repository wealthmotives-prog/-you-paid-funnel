"""Unit tests for fail-closed scanner verdict handling (no real Supabase calls)."""
import importlib.util
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

path = Path(__file__).resolve().parents[1] / "scripts" / "evidence_scanner_worker.py"
spec = importlib.util.spec_from_file_location("yp_scanner", path)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class ScannerVerdictTests(TestCase):
    def test_clean_requires_hash(self):
        with self.assertRaises(ValueError):
            worker.verdict("job", "clean", lease_token="test-lease")

    def test_stale_job_update_must_fail(self):
        with patch.object(worker, "api", return_value=[]) as api:
            with self.assertRaisesRegex(RuntimeError, "not persisted"):
                worker.verdict("job", "rejected", lease_token="test-lease", code="malware_detected")
            self.assertIn("state=eq.scanning", api.call_args.args[0])
            self.assertTrue(api.call_args.kwargs["return_rows"])

    def test_confirmed_clean_update(self):
        with patch.object(worker, "api", return_value=[{"state": "clean"}]) as api:
            worker.verdict("job", "clean", lease_token="test-lease", digest="a" * 64)
            self.assertEqual(api.call_args.kwargs["data"]["actual_sha256"], "a" * 64)

    def test_invalid_transition(self):
        with self.assertRaises(ValueError):
            worker.verdict("job", "queued", lease_token="test-lease")

    def test_missing_lease_is_blocked(self):
        with self.assertRaises(ValueError):
            worker.verdict("job", "clean", lease_token="", digest="a" * 64)
