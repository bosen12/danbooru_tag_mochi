# Release notes

## Unreleased

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
