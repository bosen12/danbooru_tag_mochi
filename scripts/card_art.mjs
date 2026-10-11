#!/usr/bin/env node
/**
 * 整本詞庫的卡面清單：給烘焙腳本拿 prompt，也給人看每一級各有幾張。
 *
 *   node scripts/card_art.mjs            # 摘要
 *   node scripts/card_art.mjs --prompts  # JSON：[{tag, file, positive, negative, rating}]
 *   node scripts/card_art.mjs --write    # 寫進 scripts/card_jobs.json（沒裝 node 的人烘焙時用這份）
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ACT_PLACE, indexLexicon } from "../web/engine.js";
import { ratingBlocked } from "../web/rules/rating.js";
import { artPrompt, artFile, isCard, cardSuit, ratingTier, HARD_BANNED } from "../web/card-art.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const JOBS_FILE = join(ROOT, "scripts", "card_jobs.json");

/** card_jobs.json 的內容：一張牌一行，改了詞庫之後 diff 看得出哪幾張的 prompt 變了。 */
export function jobsFileText(jobs) {
  return "[\n" + jobs.map((j) => "  " + JSON.stringify(j)).join(",\n") + "\n]\n";
}

/**
 * 角色牌照熱門度烘（Danbooru 2024-07 的貼文數，scripts/characters.json）：六百多張要烘一個多小時，
 * 中途停掉也先有最常用的角色。開源版沒有 characters.json，就照 card_jobs.json 裡已經排好的順序。
 */
function characterRank() {
  const chars = join(ROOT, "scripts", "characters.json");
  if (existsSync(chars)) {
    const posts = new Map(JSON.parse(readFileSync(chars, "utf8")).map((c) => [c.tag, c.posts_2024_07 || 0]));
    return (tag) => -(posts.get(tag) || 0);
  }
  const order = existsSync(JOBS_FILE) ? new Map(JSON.parse(readFileSync(JOBS_FILE, "utf8")).map((j, i) => [j.tag, i])) : new Map();
  return (tag) => order.get(tag) ?? 1e9;
}

export function cardArtJobs() {
  const data = JSON.parse(readFileSync(join(ROOT, "web/lexicon.json"), "utf8"));
  const lex = indexLexicon(data);
  const ctx = { byTag: lex.byTag, actPlace: ACT_PLACE, ratingBlocked };
  const jobs = [];
  const cards = [];
  for (const item of data.tags) {
    if (!isCard(item)) continue;
    cards.push(item);
    const art = artPrompt(item, ctx);
    if (art) jobs.push({ tag: item.tag, file: artFile(item.tag), positive: art.positive, negative: art.negative, rating: art.rating, ...(art.kind ? { kind: art.kind } : {}) });
  }
  const rank = characterRank();
  const isChar = (j) => j.kind === "character";
  // 一般卡面照詞庫順序；角色牌接在後面，熱門的先（sort 是穩定的，一樣熱門照詞庫順序）。
  const sorted = [...jobs.filter((j) => !isChar(j)), ...jobs.filter(isChar).sort((a, b) => rank(a.tag) - rank(b.tag))];
  return { data, cards, jobs: sorted };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { cards, jobs } = cardArtJobs();
  if (process.argv.includes("--prompts")) {
    process.stdout.write(JSON.stringify(jobs));
  } else if (process.argv.includes("--write")) {
    writeFileSync(JOBS_FILE, jobsFileText(jobs), "utf8");
    console.log("wrote", JOBS_FILE, jobs.length, "jobs");
  } else {
    const count = (f) => jobs.filter(f).length;
    console.log("cards", cards.length, "with art", jobs.length, "hard-banned", HARD_BANNED.join(","));
    for (const r of ["general", "sensitive", "explicit"]) console.log(" ", r, count((j) => j.rating === r));
    const suits = {};
    for (const c of cards) suits[cardSuit(c)] = (suits[cardSuit(c)] || 0) + 1;
    console.log("suits", suits);
    void ratingTier;
  }
}
