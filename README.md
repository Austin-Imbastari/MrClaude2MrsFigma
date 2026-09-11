# MrClaude2MrsFigma

Paste HTML (from a Claude Design artifact, or anywhere) into a Figma
plugin and get back real, editable Auto Layout frames, text, and images —
not a screenshot.

Personal-use plugin. Not published to the Figma Community.

## Setup

1. `npm install`
2. `npm run build`
3. In Figma desktop: **Plugins → Development → Import plugin from
   manifest...** and select this repo's `manifest.json`.

## Usage

1. Run the plugin (**Plugins → Development → MrClaude2MrsFigma**).
2. Paste HTML into the text box. For a Claude Design artifact, copy the
   full HTML source of the artifact.
3. Click **Import to Figma**. A new frame appears on the canvas,
   selected and zoomed to fit.

Fonts not installed in Figma fall back to Inter automatically. Images
referenced by URL are fetched and embedded as fills.

## How it works

Built on the open-sourced (now-abandoned) engine behind the commercial
"html.to.design" Figma plugin — see `NOTICE` for attribution. Pasted HTML
is rendered in a hidden iframe so real computed styles/layout can be
read, converted to a layer-tree JSON, and then turned into Figma nodes
via the Figma Plugin API.

## Development

- `npm run build` — bundle `src/code.ts` and `src/ui.ts` into `dist/`
- `npm run typecheck` — TypeScript check with no emit
- `npm test` — runs the one automatable test (structural check of the
  vendored HTML→layer-JSON extractor via jsdom; jsdom has no real layout
  engine, so this only checks node types/hierarchy, not pixel values)

## Manual smoke test

No Figma test runtime exists, so the full import path is verified by
hand after any change to `src/vendor/plugin/**` or `src/code.ts`:

- [ ] Simple card (padding + rounded background + text) imports with
      correct size/position.
- [ ] A flex row imports as a horizontal Auto Layout frame.
- [ ] A flex column with nested text + image imports as a vertical Auto
      Layout frame with the image fill present.
- [ ] A font not installed locally falls back to Inter without erroring.
- [ ] Empty or garbage input shows an error / stays disabled instead of
      creating nothing silently or crashing the plugin.
