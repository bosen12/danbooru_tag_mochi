/** Traditional Chinese copy for trace events. Engine never imports this. */

const SOURCE_ZH = {
  pin: "釘選",
  preset: "組合",
  must_draw: "必抽",
  random: "隨機抽取",
  implies: "暗示帶入",
  bind: "綁定帶入",
  era_anchor: "時代錨",
  repair: "場景補救",
  fixed: "固定品質",
  lora_trigger: "LoRA 觸發詞",
};

export function sourceLabel(source) {
  return SOURCE_ZH[source] || source || "";
}

export function formatTraceReason(event, { labelOf, mode } = {}) {
  const label = typeof labelOf === "function" ? labelOf(event.tag) : event.tag;
  const related = (event.related || []).map((t) => (typeof labelOf === "function" ? labelOf(t) : t));
  const rel = related.join("、");
  const scene = mode === "weird" ? "奇葩" : mode === "diverse" ? "多元" : "正常";
  switch (event.reason) {
    case "sport_place_mismatch":
      return `${label}未加入：目前場地是${rel || "其他場地"}；${scene}模式下運動器材與場地不相容。`;
    case "underwear_hidden":
      return `${label}已移除：完整服裝遮住內衣，且畫面沒有露出或脫衣動作。`;
    case "clothing_layer":
      return `${label}已移除：裸體與完整服裝不能同時留下。`;
    case "user_ban":
      return `${label}未加入：使用者封禁。`;
    case "rating_mismatch":
      return `${label}未加入：尺度或分級不符。`;
    case "heat_mismatch":
      return `${label}未加入：尺度不符。`;
    case "era_mismatch":
      return `${label}未加入：時代不符。`;
    case "cast_mismatch":
      return `${label}未加入：性別或人數不符。`;
    case "mutex":
    case "extra_mutex":
      return `${label}未加入：與${rel || "同格項目"}互斥。`;
    case "replaced":
      return `${label}已移除：被同格中較高優先權的${rel || "其他項目"}取代。`;
    case "pose_activity_conflict":
      return `${label}未加入：姿勢與活動衝突${rel ? "（" + rel + "）" : ""}。`;
    case "scene_activity_conflict":
      return `${label}未加入：場景與活動衝突${rel ? "（" + rel + "）" : ""}。`;
    case "missing_dependency":
      return `${label}已移除：缺少依賴條件${rel ? "（" + rel + "）" : ""}。`;
    case "reconcile":
      return `${label}已移除：收尾對帳刪除。`;
    case "repair_remove":
      return `${label}已移除：收尾修復刪除。`;
    default:
      return event.status === "rejected" ? `${label}未採用。` : `${label}：${sourceLabel(event.source)}`;
  }
}

export function sectionOfItem(item, tag) {
  if (!item) {
    if (tag === "masterpiece" || tag === "best quality" || tag === "amazing quality") return "quality";
    return "env";
  }
  if (item.section === "quality") return "quality";
  if (item.section === "subject") return "subject";
  if (item.section === "feature") return "feature";
  if (item.section === "clothing") return "clothing";
  if (item.section === "pose") return "pose";
  return "env";
}
