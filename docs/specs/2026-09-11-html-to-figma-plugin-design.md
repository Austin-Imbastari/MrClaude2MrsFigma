# MrClaude2MrsFigma — design

## Problem

Claude Design (and other tools) produce self-contained HTML/CSS UI mockups.
There's no fast way to bring that into Figma as real, editable layers —
today it's a screenshot or a manual rebuild. This project is a personal
Figma plugin: paste HTML, get back nested frames, text, and images you
can actually edit in Figma.

Primary use case is pasting Claude Design artifact HTML. It should also
work on arbitrary HTML/CSS pasted from anywhere, since the conversion path
doesn't care about the source.

## Prior art (why this is small)

`@builder.io/html-to-figma` (MIT, still published on npm, source at
github.com/BuilderIO/figma-html) is the open-sourced, since-abandoned
engine behind the commercial "html.to.design" plugin. Its published `dist/`
contains two usable pieces:

- `htmlToFigma(rootElement, useFrames)` — walks a live DOM, reads computed
  styles, and returns a JSON layer tree (`FrameNode | RectangleNode |
  TextNode | SvgNode` shapes). With `useFrames: true` it nests the layers to
  match the DOM hierarchy and derives Figma *constraints* from the CSS
  (including flex). It does **not** emit Figma Auto Layout — it never sets
  `layoutMode` / `primaryAxisSizingMode` / `counterAxisSizingMode` /
  `itemSpacing` anywhere. See "Layer fidelity" below.
- `plugin/code.js` — a Figma main-thread handler for a `{type: "import",
  data: {layers}}` message that walks that JSON and creates real Figma
  nodes: `figma.createFrame()` / text nodes with font matching via
  `figma.listAvailableFontsAsync()` + fallback, and `figma.createImage()`
  for image fills.

This project vendors and adapts both pieces rather than reimplementing DOM
walking, CSS→Figma property mapping, or font/image handling from scratch.
The only genuinely new part is the input path: the original relied on a
Chrome extension injecting into a live tab; this plugin instead renders
pasted HTML into an offscreen `iframe[srcdoc]` inside the plugin's own UI
panel and injects the extractor into that iframe.

## Layer fidelity (what "editable" means here)

The import produces **real, nested, individually editable Figma layers**
matching the HTML's DOM hierarchy: frames for containers, text nodes with
matched fonts, rectangles with solid/image fills, SVG nodes, plus borders,
shadows, corner radii and constraints.

It does **not** produce Figma Auto Layout frames. Nothing in the vendored
engine emits `layoutMode` or the related sizing/spacing properties, so
imported frames are absolutely positioned with constraints rather than
auto-resizing. A user who wants Auto Layout selects an imported frame in
Figma and applies "Add auto layout" themselves. Mapping CSS flex onto Auto
Layout automatically is deliberately out of scope.

## Architecture

Standard two-context Figma plugin:

```
┌──────────────────────────┐   postMessage  ┌────────────────────────┐   postMessage  ┌──────────────────────────────┐
│ Render iframe (srcdoc)   │ ─────────────▶ │ UI thread (ui.html)    │ ─────────────▶ │ Plugin thread (code.ts)      │
│                          │ {source:       │                        │ {type:"import",│                              │
│ - pasted HTML            │  "mrclaude-    │ - textarea: paste HTML │  data:{layers}}│ - walk layer JSON            │
│ - injected extractor.ts  │   extractor",  │ - offscreen iframe     │                │ - figma.createFrame/Text/... │
│ - htmlToFigma(           │  layers}       │ - fetch image bytes    │                │ - font match + Inter fallback│
│     document.body, true) │                │   (+ webp→png)         │                │ - figma.createImage(intArr)  │
└──────────────────────────┘                └────────────────────────┘                └──────────────────────────────┘
```

The extractor must run **inside the iframe's own JS realm**. The vendored
engine reads ambient `document` / `window` / `getComputedStyle` and does
`el instanceof HTMLElement`; called from the parent UI thread against an
iframe element, the cross-realm `instanceof` is always false and every
measurement would come from the wrong window. So `src/extractor.ts` is
bundled separately and injected into the iframe as an inline `<script>`,
and it posts its result back to the UI thread.

Distribution: personal use only. Loaded locally in Figma desktop via
"Import plugin from manifest." Not published to the Figma Community.

## Components

- `manifest.json` — plugin id/name/main/ui, `networkAccess` allowlist
  (images can come from any origin the pasted HTML references; fonts are
  local to Figma so no allowlist needed there).
- `src/vendor/html-to-figma/` — vendored extraction engine, copied from
  `@builder.io/html-to-figma`'s published `dist/`. Attribution kept in
  `NOTICE` and repo README (MIT, original copyright retained).
- `src/vendor/plugin/import-layers.js` — vendored + trimmed from the
  published `dist/plugin/code.js` `"import"` handler. Trimmed of unrelated
  message types (storage, selection-to-code, etc.) that don't apply to a
  paste-only workflow.
- `src/extractor.ts` — new: the iframe-side entry point. Calls
  `htmlToFigma(document.body, true)` on `load` (waiting for `load`, not just
  parse, so images have real dimensions) and posts the layers to the parent.
- `src/code.ts` — new: thin plugin-thread shim that hands the received
  layers to `importLayers()`.
- `src/ui.template.html` + `src/ui.ts` — new: the paste textarea, "Import"
  button, offscreen iframe renderer, image byte fetching, status/error line.
  No React, no analytics (the original bundle had Google Analytics baked in
  — dropped entirely).
- `esbuild` — bundles `code.ts` → `code.js`, `extractor.ts` → a string
  inlined into the `ui.ts` bundle via `define`, and `ui.ts` → inlined into
  `ui.html` (Figma requires UI script content inline, not an external
  `<script src>`). No framework needed for a textarea and a button.

## Data flow

1. User pastes HTML into the textarea, clicks Import.
2. UI thread sets `iframe.srcdoc = pastedHtml + "<script>" + extractor +
   "</script>"`.
3. Inside the iframe, on `load`, the extractor calls
   `htmlToFigma(document.body, true)` → nested layer JSON, and posts
   `{source: "mrclaude-extractor", layers}` (or `{..., error}`) to its
   parent.
4. UI thread walks the layers and, for every `IMAGE` fill, fetches the URL,
   converts the bytes (WEBP → PNG via canvas, SVG responses become `SVG`
   layers) and stores them as `intArr`. Fetch failures log a warning and
   skip that fill rather than aborting the import. This has to happen in
   the UI thread: the plugin thread has neither `fetch` nor a canvas.
5. UI thread `parent.postMessage({pluginMessage: {type: "import", data:
   {layers}}}, "*")`.
6. Plugin thread receives it, loads available fonts once
   (`figma.listAvailableFontsAsync()`), then walks the layer tree:
   - `FRAME`/`GROUP` → `figma.createFrame()` with the layer's constraints.
   - `TEXT` → text node, match font by name (case/weight-normalized),
     fall back to Inter Regular if no match.
   - image fills → `figma.createImage(intArr)`, fills without bytes keep
     `imageHash: null` and the shape is still created.
7. Finished frame is added to the current page, selected, and the
   viewport zooms to fit it.

## Error handling

- Empty/whitespace-only paste: Import button stays disabled, no message
  sent.
- `htmlToFigma` throwing inside the iframe (malformed HTML, etc.): caught
  by the extractor, posted back as `{error}`, shown as a one-line status
  message, nothing sent to the plugin thread.
- Per-layer node creation in the plugin thread: wrapped in try/catch (as
  in the vendored code) so one bad node logs and skips rather than aborting
  the whole import.
- Image fetch failure: caught, fill skipped, warning logged to the Figma
  plugin console — the shape still gets created without its image.
- Font load failure: already handled by the vendored fallback-to-Inter
  logic.

## Testing

No Figma test runtime exists for automated tests against `figma.*`
globals, so this gets a manual smoke-test checklist in the README instead
of fake unit tests:

- [ ] Simple single-frame card (text + rounded rect) imports with correct
      size/position.
- [ ] Flex row (e.g. a nav bar) imports as a frame containing one child
      layer per item, not a flat pile of siblings.
- [ ] Flex column with nested text + image imports as a nested frame with
      the text and the image fill both present.
- [ ] An artifact using a Google Font not installed locally falls back to
      Inter without erroring.
- [ ] Pasting empty/garbage input shows an error instead of creating
      nothing silently or crashing the plugin.

## Out of scope (v1)

- Fetching a live URL instead of pasted HTML (deferred; paste covers the
  stated use case).
- Mapping CSS flex/grid onto Figma Auto Layout — the vendored engine has no
  such mapping, and writing one is novel, unverifiable-without-Figma logic.
  Imported frames can have Auto Layout applied by hand in Figma.
- Pixel-perfect CSS coverage (pseudo-elements, CSS grid subtleties,
  animations) — inherited limitation of the vendored engine, not something
  this project tries to fix.
- Publishing to the Figma Community.
