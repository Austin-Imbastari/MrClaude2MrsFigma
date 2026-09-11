# MrClaude2MrsFigma Implementation Plan

**Goal:** A personal Figma plugin: paste HTML (from a Claude Design artifact or anywhere), click Import, get real editable Auto Layout frames/text/images on the canvas.

**Architecture:** Two-context Figma plugin. The UI thread renders pasted HTML into a hidden `iframe[srcdoc]`, runs the vendored `htmlToFigma()` DOM-walker against it, and posts the resulting layer JSON to the plugin thread. The plugin thread (vendored + adapted from the same abandoned open-source engine behind the commercial html.to.design plugin) walks that JSON and creates real Figma nodes with Auto Layout, font matching, and image fills.

**Tech Stack:** TypeScript, esbuild (bundling only, no framework), `@figma/plugin-typings`, vendored `@builder.io/html-to-figma@0.0.3` (MIT), jsdom (dev-only, for the one automatable test).

**Spec:** `docs/specs/2026-09-11-html-to-figma-plugin-design.md`

## Global Constraints

- Personal use only — never publish to the Figma Community.
- No React, no analytics/telemetry of any kind (the original vendor UI shipped Google Analytics — it must not appear anywhere in this repo).
- Vendored code keeps its MIT attribution (`NOTICE` file) — do not strip copyright headers.
- No automated test can exercise real `figma.*` globals or real CSS layout (jsdom has no layout engine) — tasks that need that are verified with the manual smoke-test checklist from the spec instead of a fake automated test.
- Pin the vendored dependency to `@builder.io/html-to-figma@0.0.3` everywhere (package.json devDependency used only to `npm pack` it — the plugin itself has zero runtime npm dependencies since everything is vendored and bundled).

---

## File Structure

```
manifest.json                        # Figma plugin manifest
package.json / tsconfig.json         # tooling
build.js                             # esbuild build script
NOTICE                               # MIT attribution for vendored code
LICENSE                              # MIT, this repo's own code
README.md                            # setup, usage, smoke-test checklist
src/
  code.ts                            # plugin-thread entry point
  ui.ts                              # UI-thread entry point
  ui.template.html                   # UI shell, build.js injects the bundled script
  vendor/
    html-to-figma/                   # vendored DOM -> layer-JSON extraction engine
    helpers.js + helpers.d.ts        # vendored (used by plugin/import-layers.js)
    functions/buffer-to-base64.js    # vendored
    plugin/
      import-layers.js               # vendored + trimmed to just the "import" handler
      traverse-layers.js             # vendored
      fast-clone.js                  # vendored
      encode-images.js               # vendored
      settings.js                    # vendored
test/
  html-to-figma.test.mjs             # structural jsdom test for the vendored extractor
dist/                                 # build output (gitignored), loaded into Figma
```

---

### Task 1: Scaffold a trivial working plugin

Prove the toolchain (manifest → esbuild → Figma desktop "Import plugin from manifest") works before adding any real logic. This plugin does nothing but draw one rectangle when you click a button — that's the whole point of this task.

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `build.js`
- Create: `src/code.ts`
- Create: `src/ui.ts`
- Create: `src/ui.template.html`
- Create: `.gitignore`

**Interfaces:**
- Produces: `npm run build` → `dist/code.js`, `dist/ui.html` (used by every later task).
- Produces: message contract `{type: "ping"}` (UI → plugin) / `{type: "pong"}` (plugin → UI), replaced in Task 4 by the real `{type: "import", data: {layers}}` contract — this task only proves the pipe works.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "mrclaude2mrsfigma",
  "version": "0.1.0",
  "private": true,
  "license": "MIT",
  "scripts": {
    "build": "node build.js",
    "typecheck": "tsc --noEmit",
    "test": "node --test test/"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.87.0",
    "esbuild": "^0.24.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "typeRoots": ["./node_modules/@figma", "./node_modules/@types"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `manifest.json`**

```json
{
  "name": "MrClaude2MrsFigma",
  "id": "mrclaude2mrsfigma-local",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["*"],
    "reasoning": "Pasted HTML can reference images/fonts hosted on any origin; they must be fetched to embed as Figma image fills."
  }
}
```

- [ ] **Step 4: Write `src/code.ts`** (plugin thread — trivial ping/pong for now)

```typescript
figma.showUI(__html__, { width: 360, height: 480 });

figma.ui.onmessage = (msg: { type: string }) => {
  if (msg.type === "ping") {
    const rect = figma.createRectangle();
    rect.resize(100, 100);
    rect.x = figma.viewport.center.x;
    rect.y = figma.viewport.center.y;
    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];
    figma.viewport.scrollAndZoomIntoView([rect]);
    figma.ui.postMessage({ type: "pong" });
  }
};
```

- [ ] **Step 5: Write `src/ui.ts`** (UI thread — trivial button for now)

```typescript
const button = document.getElementById("run") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLDivElement;

button.addEventListener("click", () => {
  status.textContent = "Sending...";
  parent.postMessage({ pluginMessage: { type: "ping" } }, "*");
});

window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage;
  if (msg?.type === "pong") {
    status.textContent = "Rectangle created.";
  }
};
```

- [ ] **Step 6: Write `src/ui.template.html`**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: sans-serif; margin: 0; padding: 12px; }
      button { padding: 8px 16px; cursor: pointer; }
      #status { margin-top: 8px; color: #555; font-size: 12px; }
    </style>
  </head>
  <body>
    <button id="run">Create test rectangle</button>
    <div id="status"></div>
    <script>__UI_SCRIPT__</script>
  </body>
</html>
```

- [ ] **Step 7: Write `build.js`**

```javascript
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

async function build() {
  fs.mkdirSync("dist", { recursive: true });

  await esbuild.build({
    entryPoints: ["src/code.ts"],
    bundle: true,
    outfile: "dist/code.js",
    target: "es2020",
  });

  const uiBuild = await esbuild.build({
    entryPoints: ["src/ui.ts"],
    bundle: true,
    write: false,
    target: "es2020",
  });
  const uiScript = uiBuild.outputFiles[0].text;

  const template = fs.readFileSync("src/ui.template.html", "utf8");
  const html = template.replace("__UI_SCRIPT__", uiScript);
  fs.writeFileSync("dist/ui.html", html);

  console.log("Built dist/code.js and dist/ui.html");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 8: Write `.gitignore`**

```
node_modules/
dist/
*.tgz
```

- [ ] **Step 9: Install dependencies and build**

Run: `npm install && npm run build`
Expected: exits 0, prints `Built dist/code.js and dist/ui.html`, both files exist.

- [ ] **Step 10: Manual verification in Figma desktop**

In Figma desktop: menu → Plugins → Development → Import plugin from manifest... → select this repo's `manifest.json`. Run the plugin, click "Create test rectangle". Expected: a 100×100 rectangle appears on the canvas and the status line reads "Rectangle created."

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Scaffold Figma plugin toolchain with a trivial ping/pong test"
```

---

### Task 2: Vendor the HTML→layer-JSON extraction engine

**Files:**
- Create: `src/vendor/html-to-figma/` (multiple files, copied)
- Create: `src/vendor/helpers.js`, `src/vendor/helpers.d.ts`
- Create: `src/vendor/functions/buffer-to-base64.js`, `.d.ts`
- Create: `NOTICE`
- Test: `test/html-to-figma.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `htmlToFigma(root: HTMLElement, useFrames?: boolean): LayerNode[]` importable from `src/vendor/html-to-figma/index.js`, for Task 3 to call.

- [ ] **Step 1: Download the exact pinned source**

Run:
```bash
mkdir -p /tmp/htf-vendor && cd /tmp/htf-vendor
npm pack @builder.io/html-to-figma@0.0.3
tar -xzf builder.io-html-to-figma-0.0.3.tgz
```
Expected: `/tmp/htf-vendor/package/dist/` exists with a `lib/` subfolder.

- [ ] **Step 2: Copy the extraction engine into the repo**

Run:
```bash
mkdir -p src/vendor/functions
cp -R /tmp/htf-vendor/package/dist/lib/html-to-figma src/vendor/html-to-figma
cp /tmp/htf-vendor/package/dist/lib/helpers.js /tmp/htf-vendor/package/dist/lib/helpers.d.ts src/vendor/
cp /tmp/htf-vendor/package/dist/lib/functions/buffer-to-base64.js /tmp/htf-vendor/package/dist/lib/functions/buffer-to-base64.d.ts src/vendor/functions/
```
Expected: `src/vendor/html-to-figma/index.js` exists and exports `htmlToFigma`.

- [ ] **Step 3: Fix the copied engine's relative import of `helpers.js`**

Read `src/vendor/html-to-figma/index.js` and any file under `src/vendor/html-to-figma/helpers/` that imports `"../../helpers"` or `"../helpers"`. Since `helpers.js` moved from `dist/lib/helpers.js` to `src/vendor/helpers.js` (one level up from `src/vendor/html-to-figma/`), the relative path from inside `src/vendor/html-to-figma/**` must resolve to `../helpers.js` (from `src/vendor/html-to-figma/index.js`) or `../../helpers.js` (from `src/vendor/html-to-figma/helpers/*.js`). Update whichever import specifiers don't already match this layout — do not change anything else in these files.

- [ ] **Step 4: Write the NOTICE file**

```
This repository vendors portions of @builder.io/html-to-figma
(https://github.com/BuilderIO/figma-html), Copyright Builder.io,
licensed under the MIT License:

  src/vendor/html-to-figma/**
  src/vendor/helpers.js, src/vendor/helpers.d.ts
  src/vendor/functions/buffer-to-base64.js, .d.ts
  src/vendor/plugin/** (added in a later task)

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

- [ ] **Step 5: Write the failing structural test**

`jsdom` has no real layout engine (`getBoundingClientRect()` always returns zeros), so this test checks *node types and hierarchy*, not pixel coordinates — that's genuinely all that's automatable here; real layout is verified manually in Task 4.

```javascript
// test/html-to-figma.test.mjs
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
```

- [ ] **Step 6: Run test to verify it fails (before Step 2-3 landed, or if the import path is wrong)**

Run: `node --test test/`
Expected: if Steps 2-4 above are already done, this should actually PASS — run it now to confirm. If it fails with a module-not-found or import error, that means Step 3's path fix is wrong; fix the relative import and re-run.

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test test/`
Expected: `# pass 1`, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Vendor html-to-figma extraction engine with a structural regression test"
```

---

### Task 3: Paste-HTML UI

**Files:**
- Modify: `src/ui.ts`
- Modify: `src/ui.template.html`

**Interfaces:**
- Consumes: `htmlToFigma` from `src/vendor/html-to-figma/index.js` (Task 2).
- Produces: posts `{type: "import", data: {layers: LayerNode[]}}` to the plugin thread — this exact message shape is what Task 4's `figma.ui.onmessage` must handle.

- [ ] **Step 1: Replace `src/ui.template.html`'s body with the real UI**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, sans-serif; margin: 0; padding: 12px; display: flex; flex-direction: column; gap: 8px; height: 100vh; box-sizing: border-box; }
      textarea { flex: 1; font-family: monospace; font-size: 12px; resize: none; }
      button { padding: 8px 16px; cursor: pointer; }
      button:disabled { cursor: not-allowed; opacity: 0.5; }
      #status { color: #555; font-size: 12px; min-height: 16px; }
      #status.error { color: #c0392b; }
      iframe { display: none; }
    </style>
  </head>
  <body>
    <textarea id="html-input" placeholder="Paste HTML here..."></textarea>
    <button id="import-btn" disabled>Import to Figma</button>
    <div id="status"></div>
    <iframe id="render-frame"></iframe>
    <script>__UI_SCRIPT__</script>
  </body>
</html>
```

- [ ] **Step 2: Replace `src/ui.ts`**

```typescript
import { htmlToFigma } from "./vendor/html-to-figma/index.js";

const input = document.getElementById("html-input") as HTMLTextAreaElement;
const importBtn = document.getElementById("import-btn") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLDivElement;
const renderFrame = document.getElementById("render-frame") as HTMLIFrameElement;

function setStatus(text: string, isError = false) {
  status.textContent = text;
  status.classList.toggle("error", isError);
}

input.addEventListener("input", () => {
  importBtn.disabled = input.value.trim().length === 0;
});

importBtn.addEventListener("click", () => {
  const html = input.value.trim();
  if (!html) return;

  setStatus("Rendering...");
  importBtn.disabled = true;

  const onLoad = () => {
    renderFrame.removeEventListener("load", onLoad);
    try {
      const frameDoc = renderFrame.contentDocument;
      if (!frameDoc || !frameDoc.body) {
        throw new Error("Could not access the rendered HTML.");
      }
      const layers = htmlToFigma(frameDoc.body);
      if (!layers.length) {
        throw new Error("No importable elements found in that HTML.");
      }
      setStatus(`Importing ${layers.length} layer(s)...`);
      parent.postMessage({ pluginMessage: { type: "import", data: { layers } } }, "*");
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`, true);
      importBtn.disabled = false;
    }
  };

  renderFrame.addEventListener("load", onLoad);
  renderFrame.srcdoc = html;
});

window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;
  if (msg.type === "import-done") {
    setStatus(`Done — created ${msg.count} layer(s).`);
    importBtn.disabled = false;
  }
  if (msg.type === "import-error") {
    setStatus(`Error: ${msg.message}`, true);
    importBtn.disabled = false;
  }
};
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0, `dist/ui.html` regenerated.

- [ ] **Step 4: Manual verification**

Reload the plugin in Figma desktop (Plugins → Development → MrClaude2MrsFigma → right-click → re-run, or close/reopen). Paste `<div style="display:flex; padding: 16px; gap: 8px;"><p>Hello</p></div>` into the textarea, click "Import to Figma". Expected: status shows "Importing 1 layer(s)..." (nothing appears on canvas yet — Task 4 wires up node creation; the plugin-thread still only understands `"ping"` until then, so this step only confirms no error is thrown and the message is sent — check the Figma plugin console via Plugins → Development → Show/Hide console for a "Received message" style log you may add temporarily, or just confirm `setStatus` shows no error).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add paste-HTML UI that extracts a layer tree via the vendored engine"
```

---

### Task 4: Node builder (plugin thread) — fonts, Auto Layout, images

This is the task that actually turns layer JSON into Figma nodes. Rather than hand-write ~500 lines of font/image/Auto-Layout handling from memory, vendor it from the same pinned package and mechanically trim it to just the `"import"` flow.

**Files:**
- Create: `src/vendor/plugin/traverse-layers.js` (+`.d.ts` if present)
- Create: `src/vendor/plugin/fast-clone.js` (+`.d.ts`)
- Create: `src/vendor/plugin/encode-images.js` (+`.d.ts`)
- Create: `src/vendor/plugin/settings.js` (+`.d.ts`)
- Create: `src/vendor/plugin/import-layers.js`
- Modify: `src/code.ts`
- Modify: `NOTICE` (add `src/vendor/plugin/**` to the vendored-files list — already listed in Task 2's NOTICE text, confirm it's there)

**Interfaces:**
- Consumes: `{type: "import", data: {layers: LayerNode[]}}` message from Task 3.
- Produces: `importLayers(layers: LayerNode[]): Promise<number>` (resolves with the count of top-level layers created) exported from `src/vendor/plugin/import-layers.js`, called by `src/code.ts`.

- [ ] **Step 1: Copy the vendored plugin-thread helper files**

Run (reusing `/tmp/htf-vendor` from Task 2, Step 1 — re-run that step first if the directory was cleaned up):
```bash
mkdir -p src/vendor/plugin
cp /tmp/htf-vendor/package/dist/plugin/functions/traverse-layers.js src/vendor/plugin/traverse-layers.js
cp /tmp/htf-vendor/package/dist/plugin/functions/traverse-layers.d.ts src/vendor/plugin/traverse-layers.d.ts 2>/dev/null || true
cp /tmp/htf-vendor/package/dist/plugin/functions/fast-clone.js src/vendor/plugin/fast-clone.js
cp /tmp/htf-vendor/package/dist/plugin/functions/fast-clone.d.ts src/vendor/plugin/fast-clone.d.ts 2>/dev/null || true
cp /tmp/htf-vendor/package/dist/plugin/functions/encode-images.js src/vendor/plugin/encode-images.js
cp /tmp/htf-vendor/package/dist/plugin/functions/encode-images.d.ts src/vendor/plugin/encode-images.d.ts 2>/dev/null || true
cp /tmp/htf-vendor/package/dist/plugin/constants/settings.js src/vendor/plugin/settings.js
cp /tmp/htf-vendor/package/dist/plugin/constants/settings.d.ts src/vendor/plugin/settings.d.ts 2>/dev/null || true
```
Expected: all four `.js` files exist under `src/vendor/plugin/`.

- [ ] **Step 2: Fix relative imports in the copied files**

Read each copied `.js` file. Any `import ... from "../..."` that pointed at files outside `dist/plugin/functions/` or `dist/plugin/constants/` (e.g. `../../lib/helpers`) needs its relative path recalculated for the new location `src/vendor/plugin/`. Concretely: an import of `../../lib/helpers` (2 levels up from `dist/plugin/functions/`) must become `../helpers.js` (1 level up from `src/vendor/plugin/` to `src/vendor/`). Update only the import specifiers — do not change logic.

- [ ] **Step 3: Start from a verbatim copy, don't rewrite from memory**

Run:
```bash
cp /tmp/htf-vendor/package/dist/plugin/code.js src/vendor/plugin/import-layers.js
```
This file is the editing target for the rest of this task. Every edit below is a *deletion or mechanical rename* — never retype logic by hand, and never reproduce it from description. If a step below turns out to require inventing logic that isn't literally present in this copied file, stop and re-read `/tmp/htf-vendor/package/dist/plugin/code.js` in full before proceeding — do not guess.

- [ ] **Step 4: Delete the message-dispatch wrapper and unrelated branches**

Open `src/vendor/plugin/import-layers.js`. It ends with `figma.ui.onmessage = (msg) => __awaiter(...)` containing a sequence of `if (msg.type === "...") { ... }` blocks. Delete these branches entirely, along with any top-level function they alone depend on (nothing else in the file calls it):
- `"resize"`, `"getStorage"`, `"setStorage"`, `"init"`, `"checkIfCanGetCode"`, `"getSelectionWithImages"`, `"updateElements"`, `"clearErrors"`

Keep the `if (msg.type === "import") { ... }` block's *body*, but pull it out of the `figma.ui.onmessage` wrapper — it becomes the body of a new exported function (Step 5). Keep every helper function/constant this block references (font matching, `assign`, `allPropertyNames`, `defaultFont`, `normalizeName`, per-type node creation inside its `traverseLayers` call, any `try/catch` already present around per-layer node creation — leave that error handling exactly as written). Delete helper functions that only the branches you just deleted used (e.g. `serialize`, `postSelection`, `clearAllErrors`, `checkIfCanGetCode`, if present and unreferenced by the `"import"` body) — confirm with a text search (`grep -n functionName src/vendor/plugin/import-layers.js`) that nothing else in the file still calls a function before deleting it.

- [ ] **Step 5: Turn the kept `"import"` body into an exported function**

The kept block looked like:
```javascript
if (msg.type === "import") {
    const availableFonts = (yield figma.listAvailableFontsAsync()).filter((font) => font.fontName.style === "Regular");
    yield figma.loadFontAsync(defaultFont);
    const { data } = msg;
    const { layers } = data;
    // ... rest of the original body ...
}
```
Replace the `if (msg.type === "import") { ... }` wrapper with an exported async function, keeping the original body's statements unchanged except for the two named replacements shown:
```javascript
export function importLayers(layers) {
    return __awaiter(this, void 0, void 0, function* () {
        const availableFonts = (yield figma.listAvailableFontsAsync()).filter((font) => font.fontName.style === "Regular");
        yield figma.loadFontAsync(defaultFont);
        // ... rest of the original body, unchanged, except:
        //   - delete the two lines `const { data } = msg;` and
        //     `const { layers } = data;` (this function receives `layers`
        //     as its parameter directly)
        //   - wherever the original body returns/exits early, instead make
        //     the function resolve with the count of top-level layers it
        //     created (add a counter incremented once per `rootLayer` in
        //     the original's top-level loop, return it at the end)
        return createdCount;
    });
}
```
Add `import { __awaiter } from "..."` only if the file's existing top-of-file `__awaiter` helper (already present verbatim from the original — do not delete it in Step 4) isn't already in scope; it is defined in this same file at the top, so no new import is needed.

- [ ] **Step 6: Fix this file's relative imports**

Same class of fix as Task 2 Step 3 and Task 4 Step 2: any `import ... from "./functions/traverse-layers"` etc. must point at the sibling files copied in Step 1 (`./traverse-layers.js`, `./fast-clone.js`, `./encode-images.js`, `./settings.js`), and any import reaching into `../lib/helpers` must become `../helpers.js`.

- [ ] **Step 7: Rewrite `src/code.ts`**

```typescript
import { importLayers } from "./vendor/plugin/import-layers.js";

figma.showUI(__html__, { width: 360, height: 480 });

figma.ui.onmessage = async (msg: { type: string; data?: { layers: unknown[] } }) => {
  if (msg.type !== "import" || !msg.data) return;
  try {
    const count = await importLayers(msg.data.layers as any);
    figma.viewport.scrollAndZoomIntoView(figma.currentPage.selection);
    figma.ui.postMessage({ type: "import-done", count });
  } catch (err) {
    figma.ui.postMessage({ type: "import-error", message: (err as Error).message });
  }
};
```

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: exits 0. If esbuild reports an unresolved import inside `import-layers.js`, fix the relative path (same class of fix as Task 4 Step 2) and rebuild.

- [ ] **Step 9: Manual verification — run the spec's full smoke-test checklist**

Reload the plugin in Figma desktop. For each item, paste the given HTML into the textarea and click Import:

1. **Simple card:** `<div style="padding:16px; background:#eee; border-radius:8px;"><p>Hello</p></div>` — expect a frame with correct size/position and a text node reading "Hello".
2. **Flex row:** `<div style="display:flex; flex-direction:row; gap:12px;"><div style="width:40px;height:40px;background:red;"></div><div style="width:40px;height:40px;background:blue;"></div></div>` — expect a horizontal Auto Layout frame (check the frame's Auto Layout icon/properties in the Figma right panel) containing two rectangles.
3. **Flex column with text + image:** `<div style="display:flex; flex-direction:column; gap:8px;"><p>Caption</p><img src="https://picsum.photos/200" /></div>` — expect a vertical Auto Layout frame with a text node and an image fill.
4. **Unavailable font:** `<p style="font-family: 'SomeFontThatDoesNotExist';">Text</p>` — expect the text node to import using a fallback font (e.g. Inter) without an error in the status line.
5. **Garbage input:** paste `<<<not html>>>` or leave the box empty — expect the Import button to stay disabled for empty input, and for garbage input, expect either a graceful parse (browsers are lenient) or a visible error message — not a silent no-op and not a crashed plugin.

Expected overall: all five behave as described. If any fails, fix the relevant vendored/adapted code and re-run the full checklist before moving on.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Wire up node creation: Auto Layout, font matching, and image fills"
```

---

### Task 5: README, licensing, polish

**Files:**
- Create: `README.md`
- Create: `LICENSE`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by other tasks — this is the final task.

- [ ] **Step 1: Write `LICENSE`** (MIT, this repo's own code)

```
MIT License

Copyright (c) 2026 Austin Imbastari

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

Portions of this software are vendored from third-party MIT-licensed code —
see NOTICE for details and their original copyright.
```

- [ ] **Step 2: Write `README.md`**

```markdown
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
```

- [ ] **Step 3: Verify the build is still clean end to end**

Run: `npm install && npm run typecheck && npm run build && npm test`
Expected: all four commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add README and LICENSE"
git push
```
