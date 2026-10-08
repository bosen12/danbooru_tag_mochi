#!/usr/bin/env python3
"""Path, yaml, and checksum tests for scripts/fetch_upscale_model.py. Temp dirs only."""
from __future__ import annotations

import hashlib
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import fetch_upscale_model as fum  # noqa: E402

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    if cond:
        print(f"ok   {name}")
    else:
        failed += 1
        print(f"FAIL {name}" + (f"\n  {detail}" if detail else ""))


with tempfile.TemporaryDirectory() as tmp_s:
    tmp = Path(tmp_s)
    ckpt = tmp / "ComfyUI" / "models" / "checkpoints" / "ill"
    ckpt.mkdir(parents=True)
    derived = fum.derive_upscale_dir(ckpt)
    ok(
        "checkpointDir walks up to models/upscale_models",
        derived == tmp / "ComfyUI" / "models" / "upscale_models",
        str(derived),
    )
    ok("no models ancestor", fum.derive_upscale_dir(tmp / "loose" / "ckpts") is None)
    ok(
        "yaml sits next to the models directory",
        fum.extra_yaml_beside_models(ckpt) == tmp / "ComfyUI" / "extra_model_paths.yaml",
    )

    block_base = tmp / "absolute-block"
    text = (
        "ignored:\n"
        "  base_path: somewhere\n"
        "  loras: loras/\n"
        "ext:\n"
        f"  base_path: {(tmp / 'external').as_posix()}\n"
        "  upscale_models: upscale\n"
        "block:\n"
        f"  base_path: {block_base.as_posix()}\n"
        "  upscale_models: |\n"
        "    one/up\n"
        "    two/up\n"
        "rel:\n"
        "  base_path: relmodels\n"
        "  upscale_models: upscale_models\n"
    )
    parsed = fum.upscale_dirs_from_yaml(text, tmp / "ComfyUI")
    got = [os.path.normpath(p) for p in parsed]
    want = [
        os.path.normpath(tmp / "external" / "upscale"),
        os.path.normpath(block_base / "one" / "up"),
        os.path.normpath(block_base / "two" / "up"),
        os.path.normpath(tmp / "ComfyUI" / "relmodels" / "upscale_models"),
    ]
    ok("yaml upscale_models paths", got == want, f"{got}\nvs\n{want}")

    custom = tmp / "custom-up"
    yaml_path = tmp / "ComfyUI" / "extra_model_paths.yaml"
    yaml_path.write_text(
        "ext:\n"
        f"  base_path: {(tmp / 'external').as_posix()}\n"
        "  upscale_models: upscale\n",
        encoding="utf-8",
    )
    dirs = fum.collect_dirs(
        {"comfy": {"checkpointDir": str(ckpt), "upscaleModelDir": str(custom)}},
        yaml_path=yaml_path,
    )
    ok("configured dir is first", dirs and dirs[0] == custom, str(dirs))
    ok(
        "derived dir is second",
        len(dirs) >= 2 and dirs[1] == tmp / "ComfyUI" / "models" / "upscale_models",
        str(dirs),
    )
    ok(
        "yaml dir is included",
        any(os.path.normpath(p) == os.path.normpath(tmp / "external" / "upscale") for p in dirs),
        str(dirs),
    )

    calls: list[Path] = []

    def _no_download(dest):
        calls.append(dest)
        raise AssertionError("download should not run")

    listed = fum.execute(
        [r"packs\RealESRGAN_x4plus_anime_6B.pth"],
        [],
        False,
        _no_download,
    )
    ok("Comfy listing the file skips download", listed == 0 and calls == [], str(calls))

    held = tmp / "external" / "upscale" / "nested"
    held.mkdir(parents=True)
    (held / fum.NAME).write_bytes(b"present")
    calls.clear()
    skipped = fum.execute(None, [tmp / "external" / "upscale"], False, _no_download)
    ok("Comfy down and a file on disk skips download", skipped == 0 and calls == [], str(calls))

    empty = tmp / "empty-up"
    empty.mkdir()
    calls.clear()

    def _grab(dest):
        calls.append(Path(dest))
        return 0

    need = fum.execute([], [empty], False, _grab, check_only=True)
    ok("Comfy up without the file asks for a download", need == 3 and calls == [], str((need, calls)))
    need = fum.execute([], [empty], False, _grab, check_only=False)
    ok("download target is the resolved folder", need == 0 and calls == [empty], str(calls))

    calls.clear()
    missing = fum.execute(None, [tmp / "no" / "such" / "parent"], False, _grab)
    ok("no writable folder does not download", missing == 0 and calls == [], str(calls))

    good = b"good"
    part = tmp / "model.pth.part"
    dest = tmp / "model.pth"
    part.write_bytes(b"bad!")
    digest = hashlib.sha256(good).hexdigest()
    ok("bad hash does not rename", fum.commit_part(part, dest, len(good), digest) is False)
    ok("bad hash deletes the part", not part.exists() and not dest.exists())
    part.write_bytes(good)
    ok("matching hash renames", fum.commit_part(part, dest, len(good), digest) is True)
    ok("renamed bytes match", dest.read_bytes() == good and not part.exists())

sys.path.insert(0, str(ROOT))
import workflows  # noqa: E402

_combo = {
    "UpscaleModelLoader": {
        "input": {
            "required": {
                "model_name": [
                    "COMBO",
                    {"options": [r"packs\RealESRGAN_x4plus_anime_6B.pth"]},
                ]
            }
        }
    }
}
_names = workflows.combo_list(_combo, "UpscaleModelLoader", "model_name")
ok("new object_info lists the anime 4x", fum.model_listed(_names), str(_names))

if failed:
    print(f"\n{failed} failed")
    sys.exit(1)
print("\nok")
