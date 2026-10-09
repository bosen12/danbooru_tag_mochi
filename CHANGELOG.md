# Release notes

## Unreleased — readiness fixes after v1.0

The public application release [v1.0](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/v1.0) was published on 2026-10-08. The changes below follow that release on the main branch. They are not included in the existing v1.0 tag; clone the latest main to get them.

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
- Breast size is weighted by how common each size is instead of uniform across six options. At General with Activity, huge or gigantic fell from about 35% to under 20% of images. Every other card for the same seed is unchanged unless a rule depends on breast size.
- The card-art manifest is served without bake-only fields (prompts, seeds): about 1.07 MB → 0.46 MB parsed on every page.
- The Comfy indicator in the top bar opens the ComfyUI URL setting (Ink Pool, Fuse Bed), as the README describes. When ComfyUI is unreachable, the failed image says what to do next, in English too.
- English layout fixes: headings and buttons spaced for Chinese (“S t a r t  y o u r”) use normal letter spacing; Card Book sort arrows no longer touch their labels; the Fuse Bed touch hint is its own line.
- Windows launcher test reads cmd output in any console code page.

### Tested scope and limitations

See [the verification record](docs/RELEASE_VERIFICATION.md). The public card-art archive was actually downloaded and verified, and one General-level image was generated and saved using local ComfyUI on an RTX 5070 Ti. Optional first-time LoRA/pip installation and the roughly 2.5 GB pose download were tested with fixtures, not by changing that ComfyUI installation. Cross-platform CI evidence is recorded separately from the local checks in the verification record.

ComfyUI and an SDXL checkpoint are required to generate. Hardware and model choice affect memory use and latency; this record does not establish a universal minimum. The content-level switch constrains tags and prompts; it is not an image-content guarantee. Card-art-v4 is an asset release, separate from the application version.

## v1.0 — 2026-10-08

Standalone card workbench from danbooru_tag_random: Ink Pool, Fuse Bed, Card Book and Gallery, English/Traditional Chinese UI, tours and tutorial films. Pin illustrated Danbooru cards, let the rules engine complete a composition, and generate with local ComfyUI.
