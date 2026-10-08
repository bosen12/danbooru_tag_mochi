#!/usr/bin/env node
/**
 * 整本詞庫的卡面清單：給烘焙腳本拿 prompt，也給人看每一級各有幾張。
 *
 *   node scripts/card_art.mjs            # 摘要
 *   node scripts/card_art.mjs --prompts  # JSON：[{tag, file, positive, negative, rating}]
 *   node scripts/card_art.mjs --write    # 寫進 scripts/card_jobs.json（沒裝 node 的人烘焙時用這份）
 */
import { readFileSync, writeFileSync } from "fs";
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
    if (art) jobs.push({ tag: item.tag, file: artFile(item.tag), positive: art.positive, negative: art.negative, rating: art.rating });
  }
  return { data, cards, jobs };
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
