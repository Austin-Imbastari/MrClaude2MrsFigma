// Bundled by build.js and injected into the render iframe as an inline <script>.
// It must run inside the iframe's own JS realm: the vendored engine reads ambient
// `document` / `window` / `getComputedStyle` and does `el instanceof HTMLElement`,
// both of which are wrong (cross-realm) when called from the parent UI thread.
import { htmlToFigma } from "./vendor/html-to-figma/index.js";

type Layer = any;

const GAP = 160; // px between side-by-side section frames

// Non-rendering tags don't count as "content" when deciding how many children an
// element has — a trailing <script> sibling (state data, page-switching logic)
// must not be mistaken for a second visual section. HELMET is a Claude Design
// canvas export's own wrapper for head-like metadata (meta/link/style) sitting
// inside the body; it renders nothing itself.
const NON_VISUAL_TAGS = new Set([
  "SCRIPT", "STYLE", "LINK", "META", "TEMPLATE", "NOSCRIPT", "HELMET",
]);
function visibleChildren(el: Element): Element[] {
  return Array.from(el.children).filter((child) => !NON_VISUAL_TAGS.has(child.tagName));
}

// Most page-shaped HTML (especially Claude Design canvas exports) nests every
// visible section inside one full-page-width wrapper div. Descend through any
// such single-child chain to reach the level that actually holds multiple
// sibling sections; that's what should become separate top-level frames. If
// nothing like that exists, fall back to importing the root element as-is.
function findSections(root: Element): Element[] {
  let node = root;
  let children = visibleChildren(node);
  while (children.length === 1) {
    node = children[0];
    children = visibleChildren(node);
  }
  return children.length >= 2 ? children : [root];
}

// Claude Design canvas exports mark alternate app views/pages with
// <sc-if value="{{ isSomething }}">...</sc-if> (only one is meant to be shown at
// a time, via JS this extractor doesn't run, so all of them render at once).
// Pull a human name out of that when present; otherwise fall back to an id, a
// heading inside the section, or a plain index — every frame gets labeled with
// something meaningful instead of Figma's default "Frame".
function nameFor(el: Element, index: number): string {
  const value = el.getAttribute("value");
  const match = value && value.match(/is([A-Z][A-Za-z0-9]*)/);
  if (match) return match[1].replace(/([a-z])([A-Z])/g, "$1 $2");
  if (el.id) return el.id;
  const heading = el.querySelector("h1, h2, h3");
  const headingText = heading?.textContent?.trim();
  if (headingText) return headingText.slice(0, 60);
  return `Section ${index + 1}`;
}

function extract() {
  try {
    const sections = findSections(document.body);
    const layers: Layer[] = [];
    let x = 0;

    sections.forEach((section, i) => {
      const [root]: Layer[] = htmlToFigma(section as HTMLElement, true);
      if (!root) return;
      // htmlToFigma sizes its synthetic root from the whole page's viewport, not
      // the element passed in — override it with the section's own real box, and
      // lay sections out side by side instead of keeping their original
      // (page-flow, often huge and irrelevant once split apart) positions.
      const rect = section.getBoundingClientRect();
      root.name = nameFor(section, i);
      root.width = Math.round(rect.width) || root.width;
      root.height = Math.round(rect.height) || root.height;
      root.x = x;
      root.y = 0;
      layers.push(root);
      x += (root.width || 0) + GAP;
    });

    window.parent.postMessage({ source: "mrclaude-extractor", layers }, "*");
  } catch (err) {
    window.parent.postMessage({ source: "mrclaude-extractor", error: String(err) }, "*");
  }
}

// Wait for `load`, not just parse: an <img> that hasn't loaded yet measures 0x0 and
// the engine skips it as hidden, so every image fill would go missing.
if (document.readyState === "complete") extract();
else window.addEventListener("load", extract);
