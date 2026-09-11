# MrClaude2MrsFigma — design

## Problem

Claude Design (and other tools) produce self-contained HTML/CSS UI mockups.
There's no fast way to bring that into Figma as real, editable layers —
today it's a screenshot or a manual rebuild. This project is a personal
Figma plugin: paste HTML, get back Auto Layout frames, text, and images you
can actually edit in Figma.

Primary use case is pasting Claude Design artifact HTML. It should also
work on arbitrary HTML/CSS pasted from anywhere, since the conversion path
doesn't care about the source.

## Prior art (why this is small)

`@builder.io/html-to-figma` (MIT, still published on npm, source at
github.com/BuilderIO/figma-html) is the open-sourced, since-abandoned
engine behind the commercial "html.to.design" plugin. Its published `dist/`
contains two usable pieces:

- `htmlToFigma(rootElement)` — walks a live DOM, reads computed styles, and
  returns a JSON layer tree (`FrameNode | RectangleNode | TextNode |
  SvgNode` shapes), already flagging flex containers with Auto Layout
  properties (`layoutMode`, `primaryAxisSizingMode`, `counterAxisSizingMode`,
  `itemSpacing`).
- `plugin/code.js` — a Figma main-thread handler for a `{type: "import",
  data: {layers}}` message that walks that JSON and creates real Figma
  nodes: `figma.createFrame()` / text nodes with font matching via
  `figma.listAvailableFontsAsync()` + fallback, and `figma.createImage()`
  for image fills.

This project vendors and adapts both pieces rather than reimplementing DOM
walking, CSS→Figma property mapping, or font/image handling from scratch.
The only genuinely new part is the input path: the original relied on a
Chrome extension injecting into a live tab; this plugin instead renders
pasted HTML into a hidden `iframe[srcdoc]` inside the plugin's own UI panel.

## Architecture

Standard two-context Figma plugin:

```
┌─────────────────────────────┐        postMessage        ┌──────────────────────────────┐
│ UI thread (ui.html / ui.ts) │ ─────────────────────────▶ │ Plugin thread (code.ts)      │
│                              │  {type:"import",           │                              │
│ - textarea: paste HTML      │   data:{layers}}            │ - walk layer JSON            │
│ - hidden iframe[srcdoc]     │                              │ - figma.createFrame/Text/... │
│ - htmlToFigma(iframe.body)  │                              │ - Auto Layout properties     │
└─────────────────────────────┘                              │ - font match + Inter fallback│
                                                                │ - image fetch + createImage  │
                                                                └──────────────────────────────┘
```

Distribution: personal use only. Loaded locally in Figma desktop via
"Import plugin from manifest." Not published to the Figma Community.

## Components

- `manifest.json` — plugin id/name/main/ui, `networkAccess` allowlist
  (images can come from any origin the pasted HTML references; fonts are
  local to Figma so no allowlist needed there).
- `src/lib/html-to-figma/` — vendored extraction engine, adapted from
  `@builder.io/html-to-figma`'s published `dist/lib/html-to-figma/`.
  Attribution kept in `NOTICE` and repo README (MIT, original copyright
  retained).
- `src/code.ts` — vendored + adapted from the published `dist/plugin/code.js`
  `"import"` message handler. Trimmed of unrelated message types (storage,
  selection-to-code, etc.) that don't apply to a paste-only workflow.
- `src/ui.html` + `src/ui.ts` — new: the paste textarea, "Import" button,
  hidden iframe renderer, status/error line. No React, no analytics (the
  original bundle had Google Analytics baked in — dropped entirely).
- `esbuild` — bundles `code.ts` → `code.js` and `ui.ts` → inlined into
  `ui.html` (Figma requires UI script content inline, not an external
  `<script src>`). No framework needed for a textarea and a button.

## Data flow

1. User pastes HTML into the textarea, clicks Import.
2. UI thread sets `iframe.srcdoc = pastedHtml`, waits for `load`.
3. UI thread calls vendored `htmlToFigma(iframe.contentDocument.body)` →
   layer JSON.
4. UI thread `parent.postMessage({pluginMessage: {type: "import", data:
   {layers}}}, "*")`.
5. Plugin thread receives it, loads available fonts once
   (`figma.listAvailableFontsAsync()`), then walks the layer tree:
   - `FRAME`/`GROUP` → `figma.createFrame()`, assign Auto Layout props if
     present.
   - `TEXT` → text node, match font by name (case/weight-normalized),
     fall back to Inter Regular if no match.
   - image fills → fetch the resolved URL, decode to bytes (WEBP is
     transcoded to PNG via canvas, matching the vendored helper), fetch
     failures skip the fill and continue rather than aborting the layer.
6. Finished frame is added to the current page, selected, and the
   viewport zooms to fit it.

## Error handling

- Empty/whitespace-only paste: Import button stays disabled, no message
  sent.
- `htmlToFigma` throwing on the rendered iframe (malformed HTML, etc.):
  caught in the UI thread, shown as a one-line status message, nothing
  sent to the plugin thread.
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
- [ ] Flex row (e.g. a nav bar) imports as a horizontal Auto Layout frame.
- [ ] Flex column with nested text + image imports as a vertical Auto
      Layout frame, image fill present.
- [ ] An artifact using a Google Font not installed locally falls back to
      Inter without erroring.
- [ ] Pasting empty/garbage input shows an error instead of creating
      nothing silently or crashing the plugin.

## Out of scope (v1)

- Fetching a live URL instead of pasted HTML (deferred; paste covers the
  stated use case).
- Pixel-perfect CSS coverage (pseudo-elements, CSS grid subtleties,
  animations) — inherited limitation of the vendored engine, not something
  this project tries to fix.
- Publishing to the Figma Community.
