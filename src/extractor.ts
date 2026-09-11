// Bundled by build.js and injected into the render iframe as an inline <script>.
// It must run inside the iframe's own JS realm: the vendored engine reads ambient
// `document` / `window` / `getComputedStyle` and does `el instanceof HTMLElement`,
// both of which are wrong (cross-realm) when called from the parent UI thread.
import { htmlToFigma } from "./vendor/html-to-figma/index.js";

type Layer = any;

// htmlToFigma always wraps its output in one synthetic root FRAME covering the
// whole page. Most page-shaped HTML nests every visible section (nav, hero,
// features, footer...) inside a single full-page-width wrapper div, so the real
// sections end up two levels deep instead of being their own top-level, clickable
// frames. Descend through any such single-child wrapper chain and promote its
// children to top level, carrying forward the offset each descent strips out so
// their canvas positions stay correct.
function splitIntoSections(layers: Layer[]): Layer[] {
  if (layers.length !== 1) return layers;
  let node = layers[0];
  let offsetX = 0;
  let offsetY = 0;
  while (Array.isArray(node.children) && node.children.length === 1) {
    offsetX += node.children[0].x || 0;
    offsetY += node.children[0].y || 0;
    node = node.children[0];
  }
  if (!Array.isArray(node.children) || node.children.length < 2) return layers;
  return node.children.map((section: Layer) => ({
    ...section,
    x: (section.x || 0) + offsetX,
    y: (section.y || 0) + offsetY,
  }));
}

function extract() {
  try {
    const layers = splitIntoSections(htmlToFigma(document.body, true));
    window.parent.postMessage({ source: "mrclaude-extractor", layers }, "*");
  } catch (err) {
    window.parent.postMessage({ source: "mrclaude-extractor", error: String(err) }, "*");
  }
}

// Wait for `load`, not just parse: an <img> that hasn't loaded yet measures 0x0 and
// the engine skips it as hidden, so every image fill would go missing.
if (document.readyState === "complete") extract();
else window.addEventListener("load", extract);
