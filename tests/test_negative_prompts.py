"""自訂負面提示詞（negative_prompts.py＋server.py 的套用與 /api/negative-prompts）。

不連 ComfyUI。設定檔放暫存資料夾，不碰 data/settings.json。失敗會印 FAIL 並 exit 1。
"""

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["APP_SETTINGS"] = str(Path(tempfile.mkdtemp()) / "settings.json")

import negative_prompts as neg  # noqa: E402
import prompt_formats as pf  # noqa: E402
import server  # noqa: E402

failed = 0


def check(name, ok, detail=""):
    global failed
    if ok:
        print("ok  ", name)
    else:
        failed += 1
        print("FAIL", name, detail)


def tags(text):
    return [t.strip() for t in text.split(",") if t.strip()]


# 沒設任何規則：每一家、每個分級送出去的跟以前一字不差。
same = all(
    server._negative_text(fmt, r, False, "x.safetensors") == pf.negative_for(fmt, r, server.negative_for(r))
    for fmt in pf.FORMATS
    for r in ("general", "sensitive", "explicit")
)
check("沒有規則時跟以前一樣", same)

# 家族：劃掉、加字；防未成年的字劃不掉、也不會變成「加的字」。
server.save_negative_rule({"scope": "families", "key": "pony", "rule": {"mode": "edit", "add": ["blurry", "loli"], "remove": ["score_4", "watermark", "child"]}})
rule = server.negative_rules()["families"]["pony"]
check("防未成年的字不存進加減", "loli" not in rule["add"] and "child" not in rule["remove"], rule)
out = tags(server._negative_text("pony", "general", False, "p.safetensors"))
check("加的字在", "blurry" in out, out)
check("劃掉的字不在", "score_4" not in out and "watermark" not in out, out)
check("分級補的字還在", "rating_explicit" in out and "nsfw" in out, out)
check("防未成年的字都在", all(t in out for t in neg.AGE_GUARD), out)
check("別家不受影響", server._negative_text("illustrious", "general", False, "i.safetensors") == pf.negative_for("illustrious", "general", server.negative_for("general")))

# 底模自己一份：整串自己寫，蓋過家族。
server.save_negative_rule({"scope": "ckpts", "key": "p.safetensors", "rule": {"mode": "replace", "text": "bad anatomy, extra fingers"}})
own = tags(server._negative_text("pony", "explicit", False, "p.safetensors"))
check("整串自己寫", own[:2] == ["bad anatomy", "extra fingers"] and "blurry" not in own, own)
check("整串也接上防未成年", all(t in own for t in neg.AGE_GUARD), own)
check("同一家其他底模照家族", "blurry" in tags(server._negative_text("pony", "explicit", False, "other.safetensors")))

# 自己一份但是空的：用墨池原始預設，不跟家族改過的。
server.save_negative_rule({"scope": "ckpts", "key": "p.safetensors", "rule": {"mode": "edit"}})
check("自己一份、空的 = 墨池預設", server._negative_text("pony", "general", False, "p.safetensors") == pf.negative_for("pony", "general", server.negative_for("general")))

# 卡面烘焙不套使用者的規則：同一張牌誰烤都一樣。
check("卡面不套自訂", server._negative_text("pony", "general", False, "other.safetensors", False) == pf.negative_for("pony", "general", server.negative_for("general")))

# 自訂工作流程：自己一份優先，沒有就跟著 Illustrious 家族。
server.save_negative_rule({"scope": "families", "key": "illustrious", "rule": {"mode": "edit", "add": ["lowres"]}})
wf_default = tags(server.custom_negative(server.negative_for("general"), server.NEGATIVE, pf.ILLUSTRIOUS, workflow="wf1"))
check("工作流程跟著 Illustrious 家族", "lowres" in wf_default and "nsfw" in wf_default, wf_default)
server.save_negative_rule({"scope": "workflows", "key": "wf1", "rule": {"mode": "replace", "text": "jpeg artifacts"}})
wf_own = tags(server.custom_negative(server.negative_for("explicit"), server.NEGATIVE, pf.ILLUSTRIOUS, workflow="wf1"))
check("工作流程自己一份", wf_own[0] == "jpeg artifacts" and "lowres" not in wf_own and "loli" in wf_own, wf_own)

# 家族改回沒改東西：不存。刪掉（null）：回到跟著家族。
server.save_negative_rule({"scope": "families", "key": "illustrious", "rule": {"mode": "edit"}})
check("家族空規則不存", "illustrious" not in server.negative_rules()["families"])
server.save_negative_rule({"scope": "ckpts", "key": "p.safetensors", "rule": None})
check("刪掉自己一份", "p.safetensors" not in server.negative_rules()["ckpts"])

# 不認得的家族、scope 擋下。
for bad in ({"scope": "families", "key": "nope", "rule": {}}, {"scope": "x", "key": "a", "rule": {}}, {"scope": "ckpts", "key": "", "rule": {}}):
    try:
        server.save_negative_rule(bad)
        check("擋下 " + str(bad), False)
    except ValueError:
        check("擋下 " + bad["scope"] + "/" + (bad["key"] or "空"), True)

# 畫面用的資料：可以改的預設不含防未成年的字；分級補的字列出來。
view = server.negative_view()
ill = view["families"]["illustrious"]
check("預設裡沒有防未成年的字", not any(neg.is_guard(t) for t in ill["base"]), ill["base"])
check("列出全年齡補的字", "nsfw" in ill["rating"]["general"], ill["rating"])
check("每一家都有", set(view["families"]) == set(pf.FORMATS))

if failed:
    print(f"\n{failed} 項失敗")
    sys.exit(1)
print("\n自訂負面提示詞：全部通過")
