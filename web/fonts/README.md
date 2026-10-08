# WEB6 Chiron Hei HK

Mochi ships these assets from [danbooru_tag_random](https://github.com/bosen12/danbooru_tag_random).
Run the rebuild and verification commands below from that upstream checkout;
the standalone Mochi repository does not include the font build toolchain.
Maintainers copy rebuilt assets with `python scripts/sync_mochi.py`.

The Traditional Chinese display family, glyphs and font weights are preserved.
The English edition uses system fonts and horizontal card labels.
`../fonts.css` serves one local variable WOFF2 for current WEB6 source text and the
lexicon. It covers 2,229 codepoints and is 875,064 bytes. The full source `wght`
axis (200–900), hinting, names, and layout features are retained; CSS exposes the
same requested weights 700–800 as the previous Google Fonts stylesheet.

The conservative corpus includes all WEB6 HTML/CSS/JS text (including comments),
recursively imported shared modules resolved with the server's `web6` → `web`
fallback, decoded HTML entities/Unicode escapes, and `web/lexicon.json`. This
includes intro/tutorial and inherits card seals and labels from shared modules.
It is broader than a labels-only corpus and therefore a little larger.

New vocabulary or dynamic text uses complementary Google WOFF2 faces of the same
font version. Their ranges exclude every local codepoint and each other. Broad
Chinese ranges also exclude the granular shards, so a single new character does
not trigger the full Chinese font. Unicode outside the original Google web faces
continues through the existing body/system fallback chain. An author can add text
without rebuilding fonts. The coverage command reports characters using upstream
or system fallback and validates the saved font checksum and generated CSS.

## Source and license

Pinned source: [Google Fonts Chiron Hei HK at 4d9f95c](https://github.com/google/fonts/tree/4d9f95cfb10739fffa0a92897b6c2abc6db61dc2/ofl/chironheihk),
version 2.530. `chiron-source.json` records its immutable download URL, SHA-256,
original Unicode coverage, and the Google v7 fallback URLs/ranges captured on
2026-10-04. `chiron-subset.json` records the output checksum, corpus, and axes.
The source TTF is downloaded only when explicitly rebuilding; it is not shipped.

The font is licensed under SIL OFL 1.1; the complete copyright/license is in
`OFL.txt`. That copyright statement declares no Reserved Font Names. The subset
preserves all original name/license records and stays under OFL. Font conversion
and subsetting are allowed under that license.

## Rebuild and verify

Normal source checks require Python only and make no network requests:

```powershell
python scripts/build_web6_fonts.py --check
python scripts/test_web6_font_coverage.py
```

Optional rebuild (fontTools/Brotli versions are pinned for deterministic output):

```powershell
python -m pip install -r scripts/fonts-requirements.txt
python scripts/build_web6_fonts.py --build --download
python scripts/build_web6_fonts.py --verify
```

`--source C:/path/to/pinned.ttf` replaces `--download`. The source checksum must
match the manifest. Rebuilding also updates the `?v=<font SHA-256 prefix>` CSS URL
for immutable browser caching; no HTML or typography edits are needed.

Native Chromium checks require Playwright and access to the baseline Google
fonts. `PLAYWRIGHT_MODULE` can select an installed module; the test also checks
the bundled Codex runtime. `FONT_BASELINE_CSS` can select a captured Chrome Google
CSS response; otherwise the test retrieves Google's current browser response.

```powershell
node scripts/test_web6_fonts.mjs
```

Recorded verification in `.planning/font-browser-results/results.json`:

- Every subset glyph's outline and horizontal/vertical metrics exactly match the
  pinned source at 700 and 800; global font metrics and axes also match.
- All 2,228 glyphs supplied by the baseline have identical native canvas pixels and advances against the
  original Google Chrome font CSS at 700/800, 12/24/42px, DPR 1/1.25/2. Native
  screenshots and vertical text geometry match, without resizing screenshots.
  The additional source glyph U+3400 (a regex range endpoint in the source corpus)
  is absent from Google's web faces and is checked against the pinned TTF.
- Actual index/fuse heading and card-name glyphs use downloaded Chiron. Each
  initial page requests exactly one 875,064-byte Chiron font, including at native
  Windows-style DPR 1.25. Other fonts and backend services are stubbed for this
  isolated font contract; this is not a full application screenshot comparison.
- New character `U+9F4F` renders Chiron at both 700/800 and fetches one shared
  49,400-byte WOFF2 shard.

The previous browser-specific broad Chinese files were 4,776,956 bytes (Chrome
TTF; 3,007,102 bytes with gzip) and 2,308,488 bytes (Safari WOFF2). The new local
font CSS is 198,904 bytes, or 61,539 bytes with gzip. WOFF2 is already compressed;
gzip adds bytes to the local font and should be skipped. The exhaustive all-source-character
fixture also exercises rare symbols/comments and causes more upstream requests;
its transfer totals should not be reported as an initial-page measurement.
