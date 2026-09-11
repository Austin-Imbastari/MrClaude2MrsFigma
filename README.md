# MrClaude2MrsFigma

Drop an HTML file (from a Claude Design artifact, or anywhere) onto a
Figma plugin and get back real, editable Figma layers — one top-level
frame per visible section (nav, hero, features...), each independently
selectable, plus nested frames matching the structure within each
section, text, and image fills — not a screenshot.

The imported frames are absolutely positioned with constraints, *not*
Figma Auto Layout frames: nothing in the underlying engine emits
`layoutMode`. Select an imported frame and use Figma's own "Add auto
layout" if you want that.

Personal-use plugin. Not published to the Figma Community.

## Setup

1. `npm install`
2. `npm run build`
3. In Figma desktop: **Plugins → Development → Import plugin from
   manifest...** and select this repo's `manifest.json`.

## Usage

1. Run the plugin (**Plugins → Development → MrClaude2MrsFigma**).
2. Drag an `.html` file onto the panel, or click it to browse. For a
   Claude Design artifact, use its `.dc.html` file directly.
3. The import starts automatically. When it finishes, one frame per
   section appears on the canvas.

Fonts not installed in Figma fall back to Inter automatically. Images
referenced by URL are fetched and embedded as fills.

## How it works

Built on the open-sourced (now-abandoned) engine behind the commercial
"html.to.design" Figma plugin — see `NOTICE` for attribution. The dropped
file's HTML is rendered in an offscreen iframe so real computed
styles/layout can be read. The extractor is injected into that iframe as
an inline script (it has to run in the iframe's own JS realm to measure
the right document) and calls the vendored engine, which returns the
whole page as one nested tree wrapped in a single synthetic root frame.
Since most pages nest all their real content in one full-page-width
wrapper, the extractor then descends through any such single-child
wrapper chain and promotes that wrapper's direct children — the actual
visible sections — to be independent top-level layers instead, so they
land in Figma as separate, individually selectable frames rather than
one giant nested frame. That layer-tree JSON is posted back to the
plugin UI, which fetches any image bytes and hands the result to the
plugin thread to build Figma nodes.

## Development

- `npm run build` — bundle `src/code.ts`, `src/extractor.ts` and
  `src/ui.ts` into `dist/`
- `npm run typecheck` — TypeScript check with no emit
- `npm test` — runs the one automatable test (structural check of the
  vendored HTML→layer-JSON extractor via jsdom; jsdom has no real layout
  engine, so this only checks node types/hierarchy, not pixel values)

## Manual smoke test

No Figma test runtime exists, so the full import path is verified by
hand after any change to `src/vendor/plugin/**` or `src/code.ts`:

- [ ] Simple card (padding + rounded background + text) imports with
      correct size/position.
- [ ] A flex row imports as a frame with one child layer per item —
      correctly nested, not a flat pile of siblings on the page.
- [ ] A flex column with nested text + image imports as a nested frame
      with both the text layer and the image fill present.
- [ ] A page with multiple sections wrapped in one full-width container
      (nav, hero, footer, etc.) imports as separate top-level frames —
      one per section, positioned correctly relative to each other — not
      one giant frame containing all of them nested inside.
- [ ] A font not installed locally falls back to Inter without erroring.
- [ ] Dropping an empty or non-HTML file shows an error instead of
      creating nothing silently or crashing the plugin.
