// Bundled by build.js and injected into the render iframe as an inline <script>.
// It must run inside the iframe's own JS realm: the vendored engine reads ambient
// `document` / `window` / `getComputedStyle` and does `el instanceof HTMLElement`,
// both of which are wrong (cross-realm) when called from the parent UI thread.
import { htmlToFigma } from "./vendor/html-to-figma/index.js";

function extract() {
  try {
    const layers = htmlToFigma(document.body, true);
    window.parent.postMessage({ source: "mrclaude-extractor", layers }, "*");
  } catch (err) {
    window.parent.postMessage({ source: "mrclaude-extractor", error: String(err) }, "*");
  }
}

// Wait for `load`, not just parse: an <img> that hasn't loaded yet measures 0x0 and
// the engine skips it as hidden, so every image fill would go missing.
if (document.readyState === "complete") extract();
else window.addEventListener("load", extract);
