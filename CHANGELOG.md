# Release notes

## v1.4 — 2026-10-29

Changes since [v1.3.1](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/v1.3.1).

- **Light mode**: the half-moon button next to the language globe switches between **Dark** (default), **Light** (cream paper, ink text) and **System**. It applies before the first paint (no dark flash), is remembered across rooms and tabs, and changes every open tab. Cards keep their cream stock in both. Where the top bar is too full (phones, a few in-between widths), the button moves next to the sound button in the tool row instead of pushing the globe onto a new line. The intro and tutorial films stay dark.
- Switching appearance spreads from the button like ink on paper: the new colours open out in a soft-edged circle (View Transitions in Chrome, Edge and Safari 18; a cross-fade elsewhere; instant with reduced motion).
- Chinese top bar fits on one row again from 1366 px up to 2560 px on every room (it was two rows on the Ink Pool and Fuse Bed at 1366–1440 and everywhere at 1501–1920): icon-only tools are 36 px wide instead of 50, room tabs a little tighter, and the checkpoint shows just its icon below 1680 px (full name on hover).
- Starter buttons in the empty Ink Pool line up with the text above instead of sitting centred.
- Faster on slower machines (measured with the CPU slowed 4×): the first card you open in the Card Book appears in 0.18 s instead of 0.55 s (the lexicon index is built while the page is idle, not on the click); typing in the Ink Pool search and switching the rating take about a third less time (each card's rating check is remembered until the rating changes); the Ink Pool's longest start-up task drops from about 140 ms to 90 ms (one forced full-page layout removed).
- The About page no longer re-lays out the whole page 60 times a second while you just look at it (the floating hand of cards moves with a transform).
- Contrast: small text now reaches 4.5:1 in both themes: **Join Discord**, the ×1 on **Draw & generate**, the favorite-cards count, and red action links in light mode (such as **View achievements** in a notice).

## v1.3.1 — 2026-10-28

Changes since [v1.3](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/v1.3).

- **Install app** in the top bar is now a plain text link like **Community** (a small download arrow in front), not a boxed button.
- The install reminder appears **once**: the first time the browser says Mochi can be installed, a small card in the lower-left corner asks (after the Community prompt and the tour invitation are done). Either answer, it never asks again; the top-bar link stays until you install.
- The tour gains an **Install app** step after **Join the community**, pointing at that link.
- Once installed, or when opened from the app window, the link, the reminder and the tour step no longer appear (the browser stops offering installation).

## v1.3 — 2026-10-28

Changes since [v1.2](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/v1.2) (2026-10-27).

- **Windows portable package**: `Mochi-v1.3-windows-portable.zip` on the release page bundles the official embeddable Python 3.12 and Pillow. Unzip it and double-click `start.bat`; no Python install needed. `start.bat` uses `python\python.exe` when it is next to it. `scripts/build_portable.py` builds the zip and smoke-tests the server with the bundled Python.
- **Install as an app (PWA)**: in Chrome or Edge, **Install app** appears in the top bar; Mochi gets its own window, a desktop / Start menu icon and shortcuts to each room. The manifest no longer locks portrait.
- **Custom cards**: a new **Custom** suit in the Card Book. Bundle cards (with weights) plus words the lexicon doesn't have into one card. Pick from a full card case (suits, sub-categories, search, hover preview, filtered by the card's rating) or paste a prompt that is split into lexicon cards and words not in the lexicon. The rating can't be lower than the cards inside. **Fill** is what gets generated; **Card art** only bakes the picture (built automatically, editable), with a preview baked from your seed that replaces the art only when you save. In the Ink Pool a custom card is one slot that the engine treats as the cards inside (split it into separate cards any time); the Fuse Bed places its cards one by one. Make one from an image, a Gallery work or a deck, and share it with a `mochi-card:` code. Words about minors and banned characters are refused when pasted, saved or baked. Saved in `data/custom_cards.json`.
- **New Discord channel from an image** lists every card in that image to pick from (tags are capped at five).
- Favorite cards stop overlapping past 15 cards and scroll sideways instead.
- A card flying into its detail keeps its proportions (wide group art no longer squashes and springs back).
- Fuse Bed: character cards now show on the Cast row; they were placed but invisible.
- README states that generating sexual imagery of minors is prohibited.

## v1.2 — 2026-10-27

Changes since [v1.1](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/v1.1) (2026-10-10).

- Community: a [Mochi Discord server](https://discord.gg/UtDK9w3Hw). **Community** in the top bar opens the invite; the first visit asks once (then the tour offer appears). Each room's tour and the tutorial film's ending point to it. New **About** page (`/about.html`): a one-page introduction with live cards, the five rooms, three steps to start, and the Discord and GitHub links.
- Favorite cards show a plain count now that there is no limit (it read “0/Infinity”).
- Card Book: the card box became favorite cards (shared with the Ink Pool, unlimited); **+** sends a card straight to the Ink Pool mix while you keep browsing. The card detail no longer jumps when its works load.
- Ink Pool: queued prints that have not been sent can be removed straight away. Card spines drop trailing glosses, and 80 clashing Chinese names were renamed.
- Vocabulary: 8,179 tags / 8,147 cards (from 2,708), including 1,396 clothing tags, environments, pose features, everyday objects, wrestling, audiences and more; dates in the Card Book for every new card. Card art packs v6 through v11 (v11: 3,602 all-ages cards, thumbnails first).
- Characters: 679 adult characters in their own suit, grouped by series, with Draw characters, Same series only, Add series name, gender filters and an unlimited favorite characters list. More minor-related tags (child, child carry and 13 others) are blocked like loli.
- Parse Pool (`/parse.html`): the WD14 Tagger turns an image's tags into cards.
- Face fix (FaceDetailer, SAM when available) next to Hires, with redo and undo, and adjustable details in the workflow panel.
- Discord channel routing by rating, character, series and tag.
- How it works (`/arch.html`): the engine, rules and architecture with live examples.
- Era gains Random; rating gains a No limit switch; Included and Exclusive placement switches; images per row on the result wall; ComfyUI output cleanup keeps the latest 200 images.
- Reliability: no double prints across tabs, generation timeouts, Discord retries, resume after a server restart, a crash-safe generation log capped at 5,000 entries.
- Speed and motion: faster room switching with prerendering, no layout jumps, motion for every interaction, a faster Card Book on phones, draws in a background worker, a smooth image zoom and a screensaver film.
- Characters: 612 adult anime and game characters as a new **Characters** suit, grouped into Anime and Games and then by series (76 series). Pin several at once, or turn on **Draw characters** (one per person by gender, up to three), **Same series only** and **Add series name**. With a character in the image the engine stops drawing hair, eye, body and species traits. 1,874 characters (underage, students, child-looking, real people / VTubers, non-human, unknown age) are banned: not cards, dropped from pasted prompts, and refused by the server.
- 182 of those characters were added on 2026-10-11 (Fate servants, Genshin adults, capital ships, JoJo adults, and others). The other 546 additions stay banned under the same rules.
- Character card art is not published (copyrighted). Each start checks it; up to 20 missing are baked straight away, more than that and the setup panel asks first (Bake / Not now / Never ask).
- 25 new cards for two-person poses that work clothed at every rating: side-by-side, face-to-face, head on another's shoulder, cheek-to-cheek, high five, headpat, shared umbrella and more (2,708 → 2,733). Their all-ages art is not in card-art-v5 yet; the first start bakes them with your ComfyUI.

## v1.1 — 2026-10-10

Changes since [v1.0](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/v1.0) (2026-10-08).

- Card art pack [card-art-v5](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/card-art-v5): 1,963 all-ages cards (+29 for chest interactions, hand motifs and hugs; `group picture` and `sandwiched` redrawn). Existing v4 installs download it once on the next start and only add what is missing; cards you baked yourself are never overwritten.
- Card art that arrives late (slow connection, fast scrolling) no longer pops in or paints half an image: the card face shows a soft sweep while waiting, then the art fades in and settles from a slight zoom. Art already in the cache appears immediately as before.
- Switching pages over a remote connection is faster: `language.js` and `tokens.css` are now versioned and cached like the other files instead of being re-checked on every page. Content shows in about 125 ms instead of 330 ms (simulated 80 ms latency). The LoRA Manager long-poll now waits until the page has loaded, so it no longer takes one of the browser's six connections while cards load.
- Card Book is faster over remote connections such as Tailscale: off-screen cards are no longer laid out or painted, so relayout with all 1,972 cards dropped from about 2.4 s to 14 ms. Card art up to three screens ahead now starts loading early, and search waits until an IME finishes composing a character.
- Changed the current Mochi code distribution from MIT to GPLv3 only (`GPL-3.0-only`) on 2026-10-08; preserved the earlier MIT notice and existing permissions, separate card-art/font/vendor licenses, and identified bosen12 as the original creator. New code contributions use GPLv3.
- Windows launcher preserves explicit PORT/HOST and rejects Python below 3.9.
- Optional LoRA Manager installation and the Details link patch ask first in English or Traditional Chinese. Not now skips this launch; Never ask saves a local preference.
- Waiting for a LoRA restart no longer blocks other setup steps; repeated answers cannot start duplicate installers.
- The Details patch uses Python 3.9-compatible file writing and reports unsupported/missing targets as failures rather than claiming completion.
- The standalone repository includes core engine, setup, asset, server, launcher and isolated HTTP tests. New CI covers Linux, Windows, macOS and bilingual browser fixtures; manual dispatch adds the full historical engine suite.
- Resolve aliased LoRA roots so preferred subfolders retain ComfyUI model names and previews on macOS and Windows.
- The intro and tutorial films use text-card placeholders before card-art downloads finish; an empty manifest no longer prevents playback. Image-only collections omit missing sources.
- Windows test diagnostics use UTF-8, and launcher fixtures isolate both ProgramFiles and ProgramW6432.
- Added contribution instructions, issue forms, this changelog and verification evidence.
- Community post drafts are kept locally and excluded from the public repository.
- A device that is not allowed (often a phone on the same Wi-Fi) sees a page explaining why and how to allow it, instead of a bare JSON error; the server window notes the refused address once.
- `start.sh` listens on all interfaces like `start.bat` (still only this computer and Tailscale are allowed), so phones on Tailscale can connect on macOS and Linux too.
- Long setup steps can be stopped from the setup panel (baking hundreds of cards, the 2.5 GB pose download). Finished cards and partial downloads are kept; you are asked again next launch.
- The launchers no longer open the browser before the server is up (fast machines showed “can't reach this page” first); the server opens it once it accepts connections, and also when Mochi was already running.
- The server window says whether ComfyUI was found, instead of always printing an address.
- A ComfyUI with no checkpoints at all gets “download an SDXL checkpoint into models/checkpoints”, not a file name you never picked.
- The adult card-art question gives the real count and time (it said “about 600, over an hour”; with the current lexicon it is about 730 cards).
- README: Getting started is three steps ending with Draw & generate; advanced notes moved to Configuration; troubleshooting covers ComfyUI Desktop, text-only cards and LoRA previews.
- ComfyUI is found automatically: the regular version on port 8188 or ComfyUI Desktop on 8000. A URL you set in the page, `COMFY_API` or `comfy.api` still wins.
- When ComfyUI rejects a workflow, the failed image says which node and value instead of “HTTP Error 400: Bad Request” (a model ComfyUI does not have, a custom node that is not installed). Running out of GPU memory says what to try.
- The generation history survives a crash mid-write: the next entry no longer joins the broken line and gets lost with it.
- Your own workflow: drop any PNG ComfyUI made with it (the image carries the workflow), not only an Export (API) JSON.
- Every sampler's seed is controlled: KSamplerAdvanced's `noise_seed`, two-pass Hires and seeds wired from a primitive used to stay fixed, so every image reused the workflow's seed and the gallery recorded the wrong one. Workflows imported earlier are fixed automatically.
- LoRAs picked in the LoRA panel are added after the checkpoint when the workflow has no LoRA node mapped, instead of being silently dropped.
- The Workflow panel shows what Mochi changes (seed, size, checkpoint) and lets you choose whether the checkpoint follows the top bar; the top-bar checkpoint is struck through when the workflow keeps its own.
- When a search finds nothing, the library says why and offers one button to fix it: switch rating (“breast pile only appears at Explicit”), set Cast to Any, show all eras, or show all suits. Fuse Bed's card search does the same, and names cards that are in Blocked cards.
- Phone: Draw & generate sits right under the count, so the first screen shows it whole and no longer shows two sets of draw buttons.
- Normal scenes no longer add hand motifs (giant hand, shadow hands, too many hands, floating hands) on their own; pin them or use Diverse/Weird.
- 156 new cards for breast and chest interactions, hand motifs and hugs (2,552 → 2,708), each checked against Danbooru. 29 of them can appear at General (hugs, hands on chest, extra arms, floating hands); the rest are Sensitive or Explicit. Cards that need several girls (bust chart, surrounded by breasts) are no longer padded into two girls and two boys.
- Free Appearance slots (the ones past the five fixed slots) favor details like eyelashes, bangs, blush, makeup and build over premise-changing traits (wings, tails, blood, family relations, pregnancy). Normal scenes: about 0.7 such traits per image → 0.2. Diverse loosens non-human traits; Weird keeps the old uniform draw; Flash and Sex restore intimate details.
- Breast size is weighted by how common each size is instead of uniform across six options. At General with Activity, huge or gigantic fell from about 35% to under 20% of images. Every other card for the same seed is unchanged unless a rule depends on breast size.
- The card-art manifest is served without bake-only fields (prompts, seeds): about 1.07 MB → 0.46 MB parsed on every page.
- The Comfy indicator in the top bar opens the ComfyUI URL setting (Ink Pool, Fuse Bed), as the README describes. When ComfyUI is unreachable, the failed image says what to do next, in English too.
- English layout fixes: headings and buttons spaced for Chinese (“S t a r t  y o u r”) use normal letter spacing; Card Book sort arrows no longer touch their labels; the Fuse Bed touch hint is its own line.
- Windows launcher test reads cmd output in any console code page.
- No Google Fonts requests (privacy, offline use, about a second per page). Body text uses the bundled Chiron Hei HK (same file as the headings, full weight range); seeds use bundled IBM Plex Mono; the films' serif titles use a bundled Noto Serif TC subset. Characters outside the subsets use system fonts.
- The English edition no longer sends LoRA trigger words to Google Translate on hover (the Chinese tooltip is not useful there).

### Tested scope and limitations

See [the verification record](docs/RELEASE_VERIFICATION.md). The public card-art archive was actually downloaded and verified, and one General-level image was generated and saved using local ComfyUI on an RTX 5070 Ti. Optional first-time LoRA/pip installation and the roughly 2.5 GB pose download were tested with fixtures, not by changing that ComfyUI installation. Cross-platform CI evidence is recorded separately from the local checks in the verification record.

ComfyUI and an SDXL checkpoint are required to generate. Hardware and model choice affect memory use and latency; this record does not establish a universal minimum. The content-level switch constrains tags and prompts; it is not an image-content guarantee. Card-art-v4 is an asset release, separate from the application version.

## v1.0 — 2026-10-08

Standalone card workbench from danbooru_tag_random: Ink Pool, Fuse Bed, Card Book and Gallery, English/Traditional Chinese UI, tours and tutorial films. Pin illustrated Danbooru cards, let the rules engine complete a composition, and generate with local ComfyUI.
