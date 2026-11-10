# SerSan-Studio/.github

Source of the organization profile shown at https://github.com/SerSan-Studio.

- `profile/README.md` and `profile/assets/` are generated. Do not edit them by hand.
- `src/build.mjs` holds the copy, the design tokens and every asset generator.
- `src/type.mjs` turns text into outlines with the brand typefaces, because images on GitHub cannot load web fonts.

## Build

```
npm install
npm run build
```

The first build downloads Switzer and the SERSAN display face from the public site repository into `.cache/fonts`. Fraunces and JetBrains Mono come from npm.

## Preview

```
npm run preview
```

This renders the README through GitHub's Markdown API and writes a local page and screenshots to `.impeccable/review/`. It needs the GitHub CLI and Chrome. Options: `--scheme light`, `--width 390`, `--open`.

```
node tools/shots.mjs sheet profile/assets/hero.svg --times 1,4.7,9
node tools/shots.mjs clip profile/assets/hero.svg
```

`sheet` shows one asset at chosen moments of its loop; `clip` records the loop as an MP4 (needs ffmpeg).

## Rules the page follows

- Copy comes from the live site, sersan.io. No prices beyond what the brief card states, no results from previous employers, no certification claims.
- Colour and type come from the site: midnight `#0B1422`, ink `#F4F6FA`, the cyan-to-blue signal, one warm colour kept for refusals. Fraunces for display, Switzer for text, JetBrains Mono for code and labels.
- Dark slabs are the same in both GitHub themes. Assets that sit on the page background ship a light and a dark file; dense ones also ship a narrow layout for phones.
- Every animation is a loop with a complete resting state, and stops under `prefers-reduced-motion`.
- Images are referenced by absolute URL on the `main` branch. `ASSET_BASE=<url> npm run build` changes it.
