/**
 * 偏好卡牌標頭上的「牌組」「貼上」（墨池、卡冊共用；以前在卡冊的卡盒上）。
 *   牌組：整份偏好卡牌存成一組，或把一組換成偏好卡牌（decks.js，伺服器上一份）。
 *   貼上：一段提示詞，詞庫有的變成牌，換掉或加進偏好卡牌（paste-prompt.js）。
 * 換掉整份都給「復原」。偏好卡牌不管互斥：照貼上、牌組的順序放。
 */
import { openDecks } from "./decks.js";
import { openPaste } from "./paste-prompt.js";
import { toast } from "./ui.js";

const WHERE = "偏好卡牌";

/** hand：createHand 的那一個（要建好才會按到，所以傳 getter）。data：詞庫；isCard、zh 照房間的。 */
export function handTools({ hand, data, isCard, zh }) {
  const put = (tags, label) => {
    const h = hand();
    const was = h.replace(tags);
    toast(`${label}放進偏好卡牌了（${h.count} 張）`, { action: { label: "復原", run: () => h.replace(was) } });
  };
  const paste = () =>
    openPaste({
      where: WHERE,
      lexTags: data().tags.map((t) => t.tag),
      banned: data().characterBan || [],
      isCard,
      zh,
      apply: (tags, { replace }) => {
        const now = hand().tags();
        put(replace ? tags : [...now, ...tags.filter((t) => !now.includes(t))], "貼上的提示詞");
      },
    });
  return [
    {
      label: "牌組",
      title: "把偏好卡牌存成牌組，或把牌組換成偏好卡牌",
      onClick: () =>
        openDecks({
          where: WHERE,
          current: () => hand().tags(),
          has: isCard,
          zh,
          apply: (deck) => put(deck.tags.filter(isCard), `牌組「${deck.name}」`),
          paste,
        }),
    },
    { label: "貼上", title: "貼一段提示詞，詞庫有的變成偏好卡牌", onClick: paste },
  ];
}
