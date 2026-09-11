import { traverseLayers } from "./vendor/plugin/traverse-layers.js";
import { transformWebpToPNG } from "./vendor/plugin/encode-images.js";

// Replaced at build time (esbuild `define`) with the bundled src/extractor.ts.
declare const __EXTRACTOR_SCRIPT__: string;

const input = document.getElementById("html-input") as HTMLTextAreaElement;
const importBtn = document.getElementById("import-btn") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLDivElement;
const renderFrame = document.getElementById("render-frame") as HTMLIFrameElement;

function setStatus(text: string, isError = false) {
  status.textContent = text;
  status.classList.toggle("error", isError);
}

function getImageFills(layer: any): any[] {
  return Array.isArray(layer.fills)
    ? layer.fills.filter((item: any) => item.type === "IMAGE")
    : [];
}

// Ported from @builder.io/html-to-figma 0.0.3 `dist/plugin/ui.js` (processImages).
// The extraction engine only records `{type: "IMAGE", url}`; the plugin thread has
// neither `fetch` nor a canvas, so the bytes have to be fetched here and handed over
// as `intArr`, which is what the vendored import-layers.js consumes.
// Differences from the original: fetches the URL directly instead of through
// Builder's proxy, and sniffs webp from the content type / RIFF header instead of
// pulling in the `file-type` dependency.
async function processImages(layer: any): Promise<void> {
  const images = getImageFills(layer);
  if (!images.length) return;

  const convertToSvg = (value: string) => {
    layer.type = "SVG";
    layer.svg = value;
    layer.fills = layer.fills.filter((item: any) => item.type !== "IMAGE");
  };

  await Promise.all(
    images.map(async (image: any) => {
      try {
        if (!image.url) return;
        const url: string = image.url;
        const isSvg = url.endsWith(".svg") || url.startsWith("data:image/svg");
        const res = await fetch(url);
        const contentType = res.headers.get("content-type") || "";
        if (isSvg || contentType.includes("svg")) {
          convertToSvg(await res.text());
          return;
        }
        const intArr = new Uint8Array(await res.arrayBuffer());
        delete image.url;
        const isWebp =
          contentType.includes("image/webp") ||
          (intArr.length > 12 &&
            String.fromCharCode(...intArr.subarray(8, 12)) === "WEBP");
        image.intArr = isWebp ? await transformWebpToPNG(intArr) : intArr;
      } catch (err) {
        console.warn("Could not fetch image", layer, err);
      }
    })
  );
}

async function sendToFigma(layers: any[]) {
  for (const rootLayer of layers) {
    await traverseLayers(rootLayer, (layer: any) => processImages(layer) as any);
  }
  setStatus(`Importing ${layers.length} layer(s)...`);
  parent.postMessage({ pluginMessage: { type: "import", data: { layers } } }, "*");
}

importBtn.addEventListener("click", () => {
  const html = input.value.trim();
  if (!html) return;

  setStatus("Rendering...");
  importBtn.disabled = true;
  // The extractor runs in the iframe's own realm; the parser reaches this inline
  // script after all the pasted markup, so document.body is already populated.
  renderFrame.srcdoc = `${html}<script>${__EXTRACTOR_SCRIPT__}<\/script>`;
});

input.addEventListener("input", () => {
  importBtn.disabled = input.value.trim().length === 0;
});

window.addEventListener("message", (event: MessageEvent) => {
  // From the render iframe: extracted layer JSON (or an extraction error).
  if (event.data?.source === "mrclaude-extractor") {
    if (event.source !== renderFrame.contentWindow) return;
    const { layers, error } = event.data;
    if (error || !layers?.length) {
      setStatus(`Error: ${error || "No importable elements found in that HTML."}`, true);
      importBtn.disabled = false;
      return;
    }
    sendToFigma(layers).catch((err: Error) => {
      setStatus(`Error: ${err.message}`, true);
      importBtn.disabled = false;
    });
    return;
  }

  // From the Figma plugin thread.
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
});
