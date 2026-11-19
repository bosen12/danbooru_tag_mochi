"""第六輪的存檔回歸測試。走實際的 HTTP 路由，存檔用暫存資料夾。"""

import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def request(method, path, payload=None):
    raw = json.dumps(payload).encode() if payload is not None else b""
    handler = server.Handler.__new__(server.Handler)
    handler.path = path
    handler.command = method
    handler.client_address = ("127.0.0.1", 0)
    handler.headers = {"Content-Length": str(len(raw)), "Content-Type": "application/json"}
    handler.rfile = io.BytesIO(raw)
    with patch.object(handler, "_json") as reply:
        getattr(handler, f"do_{method}")()
        reply.assert_called_once()
        return reply.call_args.args


class StorageTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        folder = Path(tmp.name)
        for mod, attrs in (
            (card_decks, ["DECKS_PATH", "FAV_HAND_PATH", "FAV_CHARS_PATH"]),
            (card_groups, ["GROUPS_PATH", "PICKS_PATH"]),
            (custom_cards, ["CARDS_PATH", "ART_DIR", "DRAFT_DIR"]),
            (workflows, ["SETTINGS_PATH"]),
        ):
            for attr in attrs:
                guard = patch.object(mod, attr, folder / attr)
                guard.start()
                self.addCleanup(guard.stop)

    def test_stale_saves_and_explicit_restore(self):
        for path, key, content, replacement in (
            ("/api/decks", "deck", {"tags": ["red hair"]}, {"tags": ["kimono"]}),
            ("/api/custom-cards", "card", {"rating": "general", "members": [{"tag": "red hair"}]}, {"members": [{"tag": "kimono"}]}),
        ):
            with self.subTest(path=path):
                status, body = request("POST", path, {"name": "原稿", **content})
                self.assertEqual(status, 200, body)
                old = body[key]
                # 即使兩次寫入在同一毫秒內，每版仍要不同。
                with patch("time.time", return_value=old["updatedAt"] / 1000):
                    status, body = request("POST", path, {**old, **replacement})
                    self.assertEqual(status, 200, body)
                    latest = body[key]
                    self.assertGreater(latest["updatedAt"], old["updatedAt"])
                    stale = {**old, "name": "我的草稿"}
                    for version in (old["updatedAt"], None, latest["updatedAt"] + 1000):
                        status, body = request("POST", path, {**stale, "updatedAt": version})
                        self.assertEqual((status, body.get("code"), body.get(key)), (409, "stale", latest))
                    status, deleted = request("DELETE", f"{path}/{old['id']}")
                    self.assertEqual((status, deleted[key]), (200, latest))
                    status, body = request("POST", path, {**stale, "updatedAt": latest["updatedAt"]})
                    self.assertEqual((status, body.get("code"), body.get(key)), (409, "gone", None))
                    status, body = request("POST", path, {"name": "我的草稿", **content})
                    self.assertEqual(status, 200, body)
                    self.assertNotEqual(body[key]["id"], old["id"])
                    status, body = request("POST", path, {**deleted[key], "restore": True})
                    self.assertEqual(status, 200, body)
                    self.assertEqual(body[key]["id"], old["id"])
                    self.assertGreater(body[key]["updatedAt"], latest["updatedAt"])
                    self.assertEqual(request("POST", path, {**deleted[key], "restore": True})[0], 409)

    def test_legacy_deck_panel_without_version_still_works(self):
        # web7 的牌組面板不帶 updatedAt／restore：照以前的規矩（覆寫、刪掉後按復原照 id 建回來），不能全部變 409。
        status, body = request("POST", "/api/decks", {"name": "舊版", "tags": ["red hair"]})
        self.assertEqual(status, 200, body)
        deck = body["deck"]
        legacy = {k: v for k, v in deck.items() if k not in ("updatedAt",)}
        status, body = request("POST", "/api/decks", {**legacy, "name": "舊版改名"})
        self.assertEqual((status, body["deck"]["name"]), (200, "舊版改名"), body)
        self.assertEqual(request("DELETE", f"/api/decks/{deck['id']}")[0], 200)
        status, body = request("POST", "/api/decks", {**legacy, "name": "舊版改名"})
        self.assertEqual((status, body["deck"]["id"]), (200, deck["id"]), body)

    def test_custom_conflict_keeps_preview_draft(self):
        path = "/api/custom-cards"
        _, created = request("POST", path, {"name": "原稿", "rating": "general", "members": [{"tag": "red hair"}]})
        card = created["card"]
        self.assertEqual(request("POST", path, {**card, "name": "別台更新"})[0], 200)
        draft = custom_cards.new_draft()
        full, _ = custom_cards.draft_paths(draft)
        full.parent.mkdir()
        full.write_bytes(b"draft-webp")
        self.assertEqual(request("POST", path, {**card, "draft": draft})[0], 409)
        self.assertEqual(full.read_bytes(), b"draft-webp")

    def test_settings_read_failure_preserves_file(self):
        path = workflows.SETTINGS_PATH
        original = '{"comfyApi":"http://127.0.0.1:1","ckptPath":"models"}'
        path.write_text(original, encoding="utf-8")
        file_lock.backup_path(path).write_text('{"ckptPath":"older models"}', encoding="utf-8")
        read_json = workflows._read_json

        def read_blocked(candidate):
            if candidate == path:
                raise PermissionError("busy")
            return read_json(candidate)

        for api, payload in (
            ("/api/paths", {"kind": "lora", "path": ""}),
            ("/api/negative-prompts", {"scope": "ckpts", "key": "test-model", "rule": {}}),
        ):
            with self.subTest(api=api), patch.object(workflows, "_read_json", side_effect=read_blocked):
                status, body = request("POST", api, payload)
                self.assertEqual(status, 503, body)
                self.assertFalse(body["ok"])
                self.assertEqual(path.read_text(encoding="utf-8"), original)
        self.assertEqual(request("POST", "/api/paths", {"kind": "lora", "path": ""})[0], 200)
        self.assertEqual(workflows.load_settings(), {**json.loads(original), "loraPath": ""})

    def test_settings_recover_backup_and_reject_bad_shape(self):
        path = workflows.SETTINGS_PATH
        self.assertEqual(workflows.load_settings(), {})
        workflows.save_settings({"ckptPath": "models"})
        path.write_text("[]", encoding="utf-8")
        workflows.save_settings({"loraPath": "loras"})
        self.assertEqual(workflows.load_settings(), {"ckptPath": "models", "loraPath": "loras"})
        file_lock.backup_path(path).write_text("null", encoding="utf-8")
        path.write_text("{broken", encoding="utf-8")
        for _ in range(2):
            status, body = request("POST", "/api/paths", {"kind": "lora", "path": ""})
            self.assertEqual(status, 503, body)
            self.assertEqual(path.read_text(encoding="utf-8"), "{broken")

    def test_favorites_and_picks_report_read_errors(self):
        for api, field, path, initial in (
            ("/api/fav-hand", "tags", card_decks.FAV_HAND_PATH, ["red hair", "kimono"]),
            ("/api/fav-chars", "tags", card_decks.FAV_CHARS_PATH, ["example one", "example two"]),
            ("/api/group-picks", "picks", card_groups.PICKS_PATH, {"feature": {"ids": ["g-1234"], "mode": "mix"}}),
        ):
            with self.subTest(api=api):
                self.assertFalse(request("GET", api)[1]["saved"])
                self.assertEqual(request("POST", api, {field: initial})[0], 200)
                before = path.read_bytes()
                with patch.object(file_lock, "read_json", side_effect=PermissionError("busy")):
                    status, body = request("GET", api)
                    self.assertEqual(status, 503, body)
                    self.assertNotIn("saved", body)
                    if field == "tags":
                        self.assertEqual(request("POST", api, {"add": ["extra"], "remove": initial[:1]})[0], 503)
                self.assertEqual(path.read_bytes(), before)
                status, body = request("GET", api)
                self.assertEqual((status, body["saved"], body[field]), (200, True, initial))
                path.write_text("null", encoding="utf-8")
                status, body = request("GET", api)
                self.assertEqual(status, 503, body)
                self.assertNotIn("saved", body)

    def test_deck_rejects_requests_that_would_drop_cards(self):
        api = "/api/decks"
        tags = [f"round6 tag {i}" for i in range(65)]
        with patch.object(card_decks.card_usage, "_known_tags", return_value=frozenset(tags)):
            status, body = request("POST", api, {"name": "一整組", "tags": tags[:60]})
            self.assertEqual(status, 200, body)
            deck = body["deck"]
            before = card_decks.DECKS_PATH.read_bytes()
            for bad, submitted in (
                (["custom:c_12345678", "unknown"], tags[:1] + ["custom:c_12345678", "unknown"]),
                (tags[60:], tags),
            ):
                status, body = request("POST", api, {**deck, "tags": submitted})
                self.assertEqual(status, 400, body)
                self.assertEqual(body.get("bad"), bad)
                self.assertEqual(card_decks.DECKS_PATH.read_bytes(), before)
            self.assertEqual(request("GET", api)[1]["decks"], [deck])


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        with patch.dict(os.environ, {
            "APP_CONFIG": str(Path(tmp) / "config.json"),
            "COMFY_API": "http://127.0.0.1:1",
            "CARD_USAGE_PATH": str(Path(tmp) / "card_usage.json"),
            "GEN_LOG_PATH": str(Path(tmp) / "gen_log.jsonl"),
            "WORKFLOW_DATA_DIR": str(Path(tmp) / "workflows"),
            "RECIPE_DATA_DIR": str(Path(tmp) / "recipes"),
            "NO_SETUP": "1",
        }):
            import server
            from server import card_decks, card_groups, custom_cards, file_lock, workflows

            unittest.main()
