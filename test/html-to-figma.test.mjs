import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

test("htmlToFigma produces a FRAME with a TEXT child for a simple flex card", async () => {
  const dom = new JSDOM(`
    <div id="root" style="display:flex; flex-direction:column;">
      <p>Hello world</p>
    </div>
  `, { url: "http://localhost" });

  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.SVGSVGElement = dom.window.SVGSVGElement;
  global.getComputedStyle = dom.window.getComputedStyle;
  global.Node = dom.window.Node;
  global.NodeFilter = dom.window.NodeFilter;
  global.Element = dom.window.Element;
  global.SVGElement = dom.window.SVGElement;
  global.HTMLImageElement = dom.window.HTMLImageElement;
  global.HTMLPictureElement = dom.window.HTMLPictureElement;
  global.HTMLSourceElement = dom.window.HTMLSourceElement;
  global.HTMLVideoElement = dom.window.HTMLVideoElement;

  // jsdom has no real layout engine, so every getBoundingClientRect() is all zeros
  // and getComputedStyle().overflow is "" rather than "visible". The vendored code
  // treats that combination as "not visible" (isHidden) and a zero-size rect as
  // "nothing to draw" (buildTextNode), so it would skip every element. Give elements
  // and text ranges a plausible non-zero box here (test setup only, not a change to
  // the vendored logic) so a TEXT node actually gets produced.
  const fakeRect = () => ({ top: 0, left: 0, bottom: 20, right: 100, width: 100, height: 20, x: 0, y: 0 });
  dom.window.Element.prototype.getBoundingClientRect = fakeRect;
  dom.window.Range.prototype.getBoundingClientRect = fakeRect;

  const { htmlToFigma } = await import("../src/vendor/html-to-figma/index.js");
  const layers = htmlToFigma(dom.window.document.getElementById("root"));

  assert.ok(Array.isArray(layers), "htmlToFigma should return an array");
  assert.ok(layers.length >= 1, "should produce at least one root layer");
  const root = layers[0];
  assert.ok(["FRAME", "GROUP"].includes(root.type), `root should be a FRAME/GROUP, got ${root.type}`);

  const flatten = (node) => [node, ...((node.children || []).flatMap(flatten))];
  const all = layers.flatMap(flatten);
  assert.ok(all.some((n) => n.type === "TEXT"), "should produce a TEXT node for the <p>");
});
