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


WF = {"9": {"class_type": "SaveImage", "inputs": {}}}
IMG = {"outputs": {"9": {"images": [{"filename": "ours.png", "type": "output", "subfolder": ""}]}}, "status": {"status_str": "success", "completed": True, "messages": []}}


class Lifecycle(unittest.TestCase):
    """Timeout starts when drawing starts; ComfyUI-side endings are noticed; anything else drops only our prompt."""

    def run_ws(self, *, frames=None, queue=None, history=None, gen_timeout=30, recv_error=None, limit=400):
        clock = [100.0]
        calls = []

        class FakeWS:
            closed = False
            def __init__(self): self.sock = self
            def settimeout(self, seconds): pass
            def recv(self):
                clock[0] += 1
                if clock[0] - 100 > limit: raise AssertionError("gen_via_ws never ended")
                if recv_error and clock[0] >= recv_error[0]: raise recv_error[1]
                frame = frames(clock[0]) if frames else None
                if frame is None: raise server.socket.timeout()
                return 1, json.dumps(frame).encode()
            def close(self): self.closed = True
            def send(self, data, opcode): pass

        ws = FakeWS()
        def fake_api(method, path, data=None, timeout=None):
            calls.append((method, path, data, clock[0]))
            if path == "/prompt": return {"prompt_id": "our-job"}
            if path == "/queue" and method == "GET": return queue(clock[0]) if queue else {"queue_running": [], "queue_pending": [[1, "our-job", {}, {}, []]]}
            if path == "/history/our-job": return history(clock[0]) if history else {}
            if path == "/system_stats": return {"system": {"argv": []}}
            return {}

        server._DROPPED.clear()
        events, error = [], None
        with patch.object(server, "api", side_effect=fake_api), patch.object(server, "ws_connect", return_value=ws), patch.object(server, "with_content_hash", side_effect=lambda src: src), patch.object(server.time, "time", side_effect=lambda: clock[0]), patch.object(server, "GEN_TIMEOUT", gen_timeout):
            try:
                for ev in server.gen_via_ws(512, 512, 7, "test", WF):
                    events.append(ev)
            except Exception as exc:
                error = exc
        self.assertTrue(ws.closed)
        drops = [(m, p, d) for m, p, d, _ in calls if m == "POST" and p in ("/queue", "/interrupt")]
        return events, error, drops, clock[0], calls

    def assertDroppedOnlyOurs(self, drops):
        self.assertEqual(drops, [("POST", "/queue", {"delete": ["our-job"]}), ("POST", "/interrupt", {"prompt_id": "our-job"})])

    def test_waiting_in_queue_never_times_out_then_timeout_counts_from_start(self):
        # Pending until t=250 (150 s > timeout 30), then execution_start; afterwards nothing finishes.
        frames = lambda t: {"type": "execution_start", "data": {"prompt_id": "our-job"}} if t == 250 else None
        events, error, drops, end, calls = self.run_ws(frames=frames, queue=lambda t: {"queue_running": [[1, "our-job", {}, {}, []]] if t >= 250 else [], "queue_pending": [] if t >= 250 else [[1, "our-job", {}, {}, []]]})
        self.assertIsInstance(error, TimeoutError)
        self.assertGreaterEqual(end, 280, "timeout counted from execution_start, not from queueing")
        self.assertLess(end, 290)
        self.assertTrue(any(p == "/queue" and m == "GET" for m, p, _, t in calls if t < 250), "queued prompt is checked via /queue")
        self.assertDroppedOnlyOurs(drops)

    def test_first_progress_also_starts_the_clock(self):
        frames = lambda t: {"type": "progress", "data": {"prompt_id": "our-job", "value": 1, "max": 20}} if t == 200 else None
        events, error, drops, end, _ = self.run_ws(frames=frames)
        self.assertIsInstance(error, TimeoutError)
        self.assertGreaterEqual(end, 230)
        self.assertTrue(any(ev == "progress" for ev, _ in events))

    def test_queue_unreachable_still_times_out(self):
        def queue(t): raise ConnectionRefusedError(10061, "refused")
        events, error, drops, end, _ = self.run_ws(queue=queue)
        self.assertIsInstance(error, TimeoutError)
        self.assertLess(end, 140)

    def test_deleted_in_comfy_is_reported_without_waiting(self):
        events, error, drops, end, _ = self.run_ws(queue=lambda t: {"queue_running": [], "queue_pending": []})
        self.assertEqual(str(error), server.COMFY_DELETED_TEXT)
        self.assertLessEqual(end, 112, "noticed on the first /queue check (~10 s)")
        self.assertEqual(drops, [], "already gone: nothing to delete or interrupt")

    def test_history_error_without_ws_notice(self):
        hist = {"our-job": {"outputs": {}, "status": {"status_str": "error", "completed": False, "messages": [["execution_error", {"prompt_id": "our-job", "node_type": "KSampler", "exception_message": "CUDA out of memory"}]]}}}
        events, error, drops, end, _ = self.run_ws(history=lambda t: hist)
        self.assertIn("顯示卡記憶體不夠", str(error))
        self.assertLessEqual(end, 106)
        self.assertEqual(drops, [])

    def test_history_interrupted_without_ws_notice(self):
        hist = {"our-job": {"outputs": {}, "status": {"status_str": "error", "completed": False, "messages": [["execution_interrupted", {"prompt_id": "our-job"}]]}}}
        events, error, drops, end, _ = self.run_ws(history=lambda t: hist)
        self.assertEqual(str(error), "ComfyUI 中斷了這張")
        self.assertEqual(drops, [])

    def test_history_completed_without_image(self):
        hist = {"our-job": {"outputs": {}, "status": {"status_str": "success", "completed": True, "messages": []}}}
        events, error, drops, end, _ = self.run_ws(history=lambda t: hist)
        self.assertEqual(str(error), "Comfy 沒有產出圖片")
        self.assertLessEqual(end, 106)
        self.assertEqual(drops, [])

    def test_ws_execution_error_is_settled(self):
        frames = lambda t: {"type": "execution_error", "data": {"prompt_id": "our-job", "exception_message": "boom"}} if t == 103 else None
        events, error, drops, end, _ = self.run_ws(frames=frames)
        self.assertIn("boom", str(error))
        self.assertEqual(drops, [])

    def test_done_sends_no_cleanup(self):
        events, error, drops, end, _ = self.run_ws(history=lambda t: {"our-job": IMG} if t >= 103 else {})
        self.assertIsNone(error)
        self.assertEqual(events[-1][0], "done")
        self.assertEqual(drops, [])

    def test_disconnect_errors_are_plain_words_and_drop_our_prompt(self):
        for exc in (ConnectionResetError(10054, "遠端主機已強制關閉一個現存的連線。"), ConnectionAbortedError(10053, "aborted"), OSError(10054, "x"), server.urllib.error.URLError(ConnectionRefusedError(10061, "refused"))):
            with self.subTest(exc=type(exc).__name__):
                if isinstance(exc, OSError) and type(exc) is OSError: exc.winerror = 10054
                events, error, drops, end, _ = self.run_ws(recv_error=(104, exc))
                self.assertEqual(str(error), server.COMFY_GONE_TEXT)
                self.assertIsInstance(error, ConnectionError)
                self.assertDroppedOnlyOurs(drops)

    def test_ws_closed_and_history_unreachable_is_plain_words(self):
        def history(t):
            if t >= 104: raise server.urllib.error.URLError(ConnectionRefusedError(10061, "refused"))
            return {}
        events, error, drops, end, _ = self.run_ws(recv_error=(104, ConnectionError("ws closed")), history=history)
        self.assertEqual(str(error), server.COMFY_GONE_TEXT)

    def test_timeout_is_not_called_a_disconnect(self):
        self.assertFalse(server.comfy_disconnected(TimeoutError("slow")))
        self.assertFalse(server.comfy_disconnected(server.urllib.error.URLError(TimeoutError("slow"))))
        self.assertFalse(server.comfy_disconnected(server.urllib.error.HTTPError("u", 500, "x", {}, None)))
        self.assertTrue(server.comfy_disconnected(ConnectionResetError()))

    def test_close_by_genjob_drops_only_once(self):
        """GenJob gives up (nobody reattached) -> gen_via_ws finally drops; GenJob._run's own cleanup must not send again."""
        real = server.time.time
        base = real()
        fast = lambda: base + (real() - base) * 200  # 30 s reattach window passes in ~0.15 s
        calls = []

        class FakeWS:
            def __init__(self): self.sock = self
            def settimeout(self, seconds): pass
            def recv(self):
                server.time.sleep(0.005)
                raise server.socket.timeout()
            def close(self): pass
            def send(self, data, opcode): pass

        def fake_api(method, path, data=None, timeout=None):
            calls.append((method, path, data))
            if path == "/prompt": return {"prompt_id": "job-once"}
            if path == "/queue" and method == "GET": return {"queue_running": [[1, "job-once", {}, {}, []]], "queue_pending": []}
            return {}

        server._DROPPED.clear()
        with patch.object(server, "api", side_effect=fake_api), patch.object(server, "ws_connect", return_value=FakeWS()), patch.object(server.time, "time", side_effect=fast):
            job = server.GenJob(server.gen_events({"positive": "1girl", "width": 512, "height": 512, "seed": 1}), {"positive": "1girl"})
            job.left_at = fast()
            job.start()
            for _ in range(500):
                if job.finished: break
                server.time.sleep(0.01)
        self.assertTrue(job.finished)
        self.assertEqual(job.prompt_id, "job-once")
        self.assertIn("沒接回來", job.log[-1][1].get("error", ""))
        posts = [(p, d) for m, p, d in calls if m == "POST" and p in ("/queue", "/interrupt")]
        self.assertEqual(posts, [("/queue", {"delete": ["job-once"]}), ("/interrupt", {"prompt_id": "job-once"})])

    def test_cancel_then_close_does_not_resend(self):
        calls = []
        server._DROPPED.clear()
        with patch.object(server, "api", side_effect=lambda m, p, d=None, timeout=None: calls.append((m, p, d))):
            server.comfy_drop("a-job")
            server.comfy_drop("a-job")
            server.comfy_drop(None)
        self.assertEqual(calls, [("POST", "/queue", {"delete": ["a-job"]}), ("POST", "/interrupt", {"prompt_id": "a-job"})], "never a global interrupt, never twice")


class PollLifecycle(unittest.TestCase):
    def test_poll_reports_deleted_prompt(self):
        calls = []
        def fake_api(method, path, data=None, timeout=None):
            calls.append((method, path))
            if path == "/prompt": return {"prompt_id": "p-del"}
            if path == "/queue" and method == "GET": return {"queue_running": [], "queue_pending": []}
            return {}
        server._DROPPED.clear()
        with patch.object(server, "api", side_effect=fake_api), patch.object(server, "POLL_EVERY", 0.001), patch.object(server, "QUEUE_CHECK_EVERY", 0):
            with self.assertRaises(server.ComfyFinished) as got:
                list(server.gen_via_poll(64, 64, 1, "x", WF))
        self.assertEqual(str(got.exception), server.COMFY_DELETED_TEXT)
        self.assertNotIn(("POST", "/interrupt"), calls)

    def test_poll_pending_prompt_outlives_timeout(self):
        clock = [0.0]
        def fake_api(method, path, data=None, timeout=None):
            if path == "/prompt": return {"prompt_id": "p-wait"}
            if path == "/queue" and method == "GET": return {"queue_running": [], "queue_pending": [[1, "p-wait", {}, {}, []]]}
            if path.startswith("/history/") and clock[0] > 60: return {"p-wait": IMG}
            return {}
        def tick(): clock[0] += 1; return clock[0]
        server._DROPPED.clear()
        with patch.object(server, "api", side_effect=fake_api), patch.object(server, "POLL_EVERY", 0), patch.object(server, "QUEUE_CHECK_EVERY", 0), patch.object(server, "GEN_TIMEOUT", 10), patch.object(server, "with_content_hash", side_effect=lambda s: s), patch.object(server.time, "time", side_effect=tick):
            events = list(server.gen_via_poll(64, 64, 1, "x", WF))
        self.assertEqual(events[-1][0], "done")


if __name__ == "__main__": unittest.main()
