"""Offline completion recovery; never contacts real ComfyUI or writes real logs."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
stage = Path(tempfile.mkdtemp(prefix="gen-completion-"))
os.environ.update(APP_CONFIG=str(stage / "config.json"), APP_SETTINGS=str(stage / "settings.json"), GEN_LOG_PATH=str(stage / "genlog.jsonl"))
import server


class CompletionRecovery(unittest.TestCase):
    def simulate(self, *, race=False, transient=False, quiet=False):
        clock = [100.0]
        calls = []
        polls = []
        wf = {"9": {"class_type": "SaveImage", "inputs": {}}}
        history = {"our-job": {"outputs": {"9": {"images": [{"filename": "ours.png", "type": "output", "subfolder": ""}]}}}}

        class FakeWS:
            sock = None
            closed = False
            def __init__(self): self.sock = self
            def settimeout(self, seconds): pass
            def recv(self):
                clock[0] += 1
                if quiet: raise server.socket.timeout()
                if race and clock[0] == 101:
                    return 1, json.dumps({"type": "execution_success", "data": {"prompt_id": "our-job"}}).encode()
                return 1, json.dumps({"type": "progress", "data": {"prompt_id": "other-job", "value": 9, "max": 10}}).encode()
            def close(self): self.closed = True
            def send(self, data, opcode): pass

        ws = FakeWS()
        def fake_api(method, path, *args, **kwargs):
            calls.append((method, path))
            if path == "/prompt": return {"prompt_id": "our-job"}
            self.assertEqual(path, "/history/our-job", "Only our history may be fetched")
            polls.append(clock[0])
            if transient and len(polls) == 1: raise ConnectionError("temporary history outage")
            if race and clock[0] < 103: return {}
            return history

        with patch.object(server, "api", side_effect=fake_api), patch.object(server, "ws_connect", return_value=ws), patch.object(server, "with_content_hash", side_effect=lambda src: src), patch.object(server.time, "time", side_effect=lambda: clock[0]), patch.object(server, "GEN_TIMEOUT", 16):
            events = list(server.gen_via_ws(512, 512, 7, "test", wf))
        self.assertTrue(ws.closed)
        self.assertEqual(sum(ev == "done" for ev, _ in events), 1)
        self.assertIn("filename=ours.png", events[-1][1]["image"])
        self.assertTrue(polls, "Continuous frames must not starve history checks")
        self.assertFalse(any(ev == "progress" for ev, _ in events), "Foreign progress must not update this job")
        self.assertEqual(sum(path == "/prompt" for _, path in calls), 1, "Recovery never generates a second image")
        return polls

    def test_completed_history_with_continuous_foreign_frames(self): self.simulate()
    def test_history_appears_after_success_event(self): self.simulate(race=True)
    def test_transient_history_failure_recovers(self): self.simulate(transient=True)
    def test_success_event_with_transient_history_failure_recovers(self): self.simulate(race=True, transient=True)
    def test_quiet_socket_still_recovers(self): self.simulate(quiet=True)

    def test_foreign_frames_do_not_starve_heartbeat_or_cancellation(self):
        clock = [100.0]
        class FakeWS:
            closed = False
            def __init__(self): self.sock = self
            def settimeout(self, seconds): pass
            def recv(self):
                clock[0] += 1
                return 1, json.dumps({"type": "progress", "data": {"prompt_id": "other-job", "value": 9, "max": 10}}).encode()
            def close(self): self.closed = True
        ws = FakeWS()
        def fake_api(method, path, *args, **kwargs):
            return {"prompt_id": "our-job"} if path == "/prompt" else {}
        with patch.object(server, "api", side_effect=fake_api), patch.object(server, "ws_connect", return_value=ws), patch.object(server.time, "time", side_effect=lambda: clock[0]), patch.object(server, "GEN_TIMEOUT", 16):
            events = server.gen_via_ws(512, 512, 7, "test", {"9": {"class_type": "SaveImage", "inputs": {}}})
            self.assertEqual(next(events)[0], "ping")  # connected
            self.assertEqual(next(events)[1]["prompt_id"], "our-job")  # queued
            heartbeat = next(events)
            self.assertEqual(heartbeat, ("ping", {"waited": 5.0}))
            events.close()  # GenJob can cancel immediately after this yielded heartbeat.
            self.assertTrue(ws.closed)


if __name__ == "__main__": unittest.main()
