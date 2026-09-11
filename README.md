# MrClaude2MrsFigma

Drop an HTML file (from a Claude Design artifact, or anywhere) onto a
Figma plugin and get back real, editable Figma layers — one frame
nested to match the HTML structure, text, and image fills — not a
screenshot.

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
3. The import starts automatically. When it finishes, a new frame
   appears on the canvas, selected and zoomed to fit.

Fonts not installed in Figma fall back to Inter automatically. Images
referenced by URL are fetched and embedded as fills.

## How it works

Built on the open-sourced (now-abandoned) engine behind the commercial
"html.to.design" Figma plugin — see `NOTICE` for attribution. The dropped
file's HTML is rendered in an offscreen iframe so real computed
styles/layout can be read. The extractor is injected into that iframe as
an inline script (it has to run in the iframe's own JS realm to measure
the right document), posts the resulting layer-tree JSON back to the
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
- [ ] A font not installed locally falls back to Inter without erroring.
- [ ] Dropping an empty or non-HTML file shows an error instead of
      creating nothing silently or crashing the plugin.
