"""每個模型家族、底模、自訂工作流程自己的負面提示詞。

存在 data/settings.json 的 negativePrompts（手機、電腦、MCP、Discord 送的圖都照同一份）：

    {"families": {"pony": 規則}, "ckpts": {"xxx.safetensors": 規則}, "workflows": {"工作流程 id": 規則}}

規則有兩種寫法，兩份都留著，切換寫法不會弄丟另一份：
    mode "edit"：在墨池的預設上加字（add）、劃掉字（remove）。墨池之後換預設，加的、劃掉的照樣有效。
    mode "replace"：整串自己寫（text）。

底模或工作流程有自己一份就用自己的，沒有就跟著家族（自訂工作流程跟著 Illustrious，墨池替它寫的預設就是那一串）。
沒設任何規則時，送出去的負面詞跟以前一個字都不差。

不能拿掉的字：分級（全年齡／敏感）補的擋色情字、各家格式依分級補的字，以及防未成年的 AGE_GUARD。
規則怎麼寫，這些都接在最後面。
"""

from __future__ import annotations

import re

from card_art_custom import AGE_GUARD

SCOPES = ("families", "ckpts", "workflows")
MODES = ("edit", "replace")
MAX_TAGS = 200
MAX_TEXT = 4000
MAX_KEY = 300
MAX_ENTRIES = 500

_SPACE = re.compile(r"\s+")


def split_tags(text) -> list[str]:
    """逗號分開、去空白、去重（不分大小寫），保留第一次出現的寫法。"""
    out: list[str] = []
    seen: set[str] = set()
    for raw in str(text or "").replace("\n", ",").split(","):
        tag = _SPACE.sub(" ", raw).strip()
        if not tag:
            continue
        k = tag_key(tag)
        if k in seen:
            continue
        seen.add(k)
        out.append(tag)
    return out


def tag_key(tag: str) -> str:
    return _SPACE.sub(" ", str(tag)).strip().lower()


_GUARD_KEYS = {tag_key(t) for t in AGE_GUARD}


def is_guard(tag: str) -> bool:
    return tag_key(tag) in _GUARD_KEYS


def _tag_list(value) -> list[str]:
    if isinstance(value, str):
        value = split_tags(value)
    if not isinstance(value, list):
        return []
    return split_tags(",".join(str(x) for x in value if isinstance(x, (str, int, float))))[:MAX_TAGS]


def clean_rule(raw) -> dict | None:
    """使用者送來的規則 → 存檔用的樣子。

    底模／工作流程自己一份的時候，空的規則也有意義：「用墨池的原始預設，不跟家族改過的」，所以照存。
    """
    if not isinstance(raw, dict):
        return None
    mode = raw.get("mode") if raw.get("mode") in MODES else "edit"
    add = [t for t in _tag_list(raw.get("add")) if not is_guard(t)]
    remove = [t for t in _tag_list(raw.get("remove")) if not is_guard(t)]
    text = str(raw.get("text") or "")[:MAX_TEXT].strip()
    return {"mode": mode, "add": add, "remove": remove, "text": text}


def _empty_family(scope: str, rule: dict) -> bool:
    """家族沒改東西（也沒留整串的草稿）就等於沒設：不存。"""
    return scope == "families" and not active(rule) and not rule.get("text")


def clean_store(raw) -> dict:
    out = {scope: {} for scope in SCOPES}
    if not isinstance(raw, dict):
        return out
    for scope in SCOPES:
        got = raw.get(scope)
        if not isinstance(got, dict):
            continue
        for key, rule in list(got.items())[:MAX_ENTRIES]:
            key = str(key).strip()[:MAX_KEY]
            rule = clean_rule(rule)
            if key and rule and not _empty_family(scope, rule):
                out[scope][key] = rule
    return out


def set_rule(store: dict, scope: str, key: str, rule) -> dict:
    """改一條（rule 是 None 就刪掉），回傳新的整份。"""
    if scope not in SCOPES:
        raise ValueError("scope 只能是 families、ckpts、workflows")
    key = str(key or "").strip()
    if not key or len(key) > MAX_KEY:
        raise ValueError("缺少要改的家族、底模或工作流程")
    store = clean_store(store)
    rule = clean_rule(rule)
    if rule is None or _empty_family(scope, rule):
        store[scope].pop(key, None)
    else:
        if key not in store[scope] and len(store[scope]) >= MAX_ENTRIES:
            raise ValueError(f"最多存 {MAX_ENTRIES} 個")
        store[scope][key] = rule
    return store


def active(rule) -> bool:
    """這條規則會不會改到送出去的負面詞（只留著整串草稿、用加減又沒加減的不算）。"""
    if not rule:
        return False
    if rule.get("mode") == "replace":
        return True
    return bool(rule.get("add") or rule.get("remove"))


def resolve(store: dict, family: str, ckpt: str | None = None, workflow: str | None = None) -> dict | None:
    """這一張要用的規則：工作流程／底模自己一份優先，沒有就跟著家族。"""
    store = store or {}
    if workflow:
        own = (store.get("workflows") or {}).get(str(workflow))
        if own is not None:
            return own
    elif ckpt:
        own = (store.get("ckpts") or {}).get(str(ckpt))
        if own is not None:
            return own
    return (store.get("families") or {}).get(str(family or "illustrious"))


def editable(default_base: str) -> list[str]:
    """預設裡可以劃掉的字（防未成年的不在裡面）。"""
    return [t for t in split_tags(default_base) if not is_guard(t)]


def locked_for(default_full: str, default_base: str) -> list[str]:
    """分級補的字：這個分級的預設裡有、最寬鬆（限制級）的預設裡沒有的。"""
    base = {tag_key(t) for t in split_tags(default_base)}
    return [t for t in split_tags(default_full) if tag_key(t) not in base and not is_guard(t)]


def compose(default_full: str, default_base: str, rule) -> str:
    """套上規則後真正送出去的負面詞。

    default_full：照分級組好的預設（現在送的那一串）。default_base：限制級的預設（沒有分級補字），可以改的就是它。
    沒有規則就原樣回 default_full。
    """
    if not active(rule):
        return default_full
    if rule.get("mode") == "replace":
        mine = split_tags(rule.get("text"))
    else:
        removed = {tag_key(t) for t in rule.get("remove") or []}
        mine = [t for t in editable(default_base) if tag_key(t) not in removed] + list(rule.get("add") or [])
    out = split_tags(", ".join([*mine, *locked_for(default_full, default_base), *AGE_GUARD]))
    return ", ".join(out)
