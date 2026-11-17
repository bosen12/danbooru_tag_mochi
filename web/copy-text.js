/**
 * 複製一段文字。https 走 navigator.clipboard；
 * 手機用 Tailscale 的 http 沒有 clipboard，改成暫時的文字框再 execCommand("copy")。
 * 成功回 true，兩條路都失敗回 false（叫的人自己決定怎麼告訴使用者）。
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    let area = null;
    try {
      area = document.createElement("textarea");
      area.className = "sr-only";
      area.readOnly = true;
      area.value = text;
      document.body.append(area);
      area.select();
      return !!document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area?.remove();
    }
  }
}
