# Release notes

## Unreleased — readiness fixes after v1.0

The public application release [v1.0](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/v1.0) was published on 2026-10-08. The changes below follow that release on the main branch. They are not included in the existing v1.0 tag; clone the latest main to get them.

- Windows launcher preserves explicit PORT/HOST and rejects Python below 3.9.
- Optional LoRA Manager installation and the Details link patch ask first in English or Traditional Chinese. Not now skips this launch; Never ask saves a local preference.
- Waiting for a LoRA restart no longer blocks other setup steps; repeated answers cannot start duplicate installers.
- The Details patch uses Python 3.9-compatible file writing and reports unsupported/missing targets as failures rather than claiming completion.
- The standalone repository includes core engine, setup, asset, server, launcher and isolated HTTP tests. New CI covers Linux, Windows, macOS and bilingual browser fixtures; manual dispatch adds the full historical engine suite.
- Added contribution instructions, issue forms, this changelog, verification evidence and English/Traditional Chinese community post drafts.

### Tested scope and limitations

See [the verification record](docs/RELEASE_VERIFICATION.md). The public card-art archive was actually downloaded and verified, and one General-level image was generated and saved using local ComfyUI on an RTX 5070 Ti. Optional first-time LoRA/pip installation and the roughly 2.5 GB pose download were tested with fixtures, not by changing that ComfyUI installation. Cross-platform CI evidence is recorded separately from the local checks in the verification record.

ComfyUI and an SDXL checkpoint are required to generate. Hardware and model choice affect memory use and latency; this record does not establish a universal minimum. The content-level switch constrains tags and prompts; it is not an image-content guarantee. Card-art-v4 is an asset release, separate from the application version.

## v1.0 — 2026-10-08

Standalone card workbench from danbooru_tag_random: Ink Pool, Fuse Bed, Card Book and Gallery, English/Traditional Chinese UI, tours and tutorial films. Pin illustrated Danbooru cards, let the rules engine complete a composition, and generate with local ComfyUI.
