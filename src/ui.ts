import { traverseLayers } from "./vendor/plugin/traverse-layers.js";
import { transformWebpToPNG } from "./vendor/plugin/encode-images.js";

// Replaced at build time (esbuild `define`) with the bundled src/extractor.ts.
declare const __EXTRACTOR_SCRIPT__: string;

const dropzone = document.getElementById("dropzone") as HTMLDivElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const fileName = document.getElementById("file-name") as HTMLDivElement;
const status = document.getElementById("status") as HTMLDivElement;
const renderFrame = document.getElementById("render-frame") as HTMLIFrameElement;

type StatusKind = "info" | "error" | "success";

function setStatus(text: string, kind: StatusKind = "info") {
  status.classList.remove("info", "error", "success");
  status.classList.add("visible", kind);
  status.innerHTML =
    kind === "info" ? `<span class="spinner"></span><span>${text}</span>` : `<span>${text}</span>`;
}

function setBusy(busy: boolean) {
  dropzone.classList.toggle("busy", busy);
  dropzone.tabIndex = busy ? -1 : 0;
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

function importFile(file: File) {
  fileName.textContent = file.name;
  setBusy(true);
  setStatus(`Reading ${file.name}...`);

  const reader = new FileReader();
  reader.onerror = () => {
    setStatus("Could not read that file.", "error");
    setBusy(false);
  };
  reader.onload = () => {
    const html = String(reader.result || "").trim();
    if (!html) {
      setStatus("That file is empty.", "error");
      setBusy(false);
      return;
    }
    setStatus("Rendering...");
    // The extractor runs in the iframe's own realm; the parser reaches this inline
    // script after all the pasted markup, so document.body is already populated.
    renderFrame.srcdoc = `${html}<script>${__EXTRACTOR_SCRIPT__}<\/script>`;
  };
  reader.readAsText(file);
}

dropzone.addEventListener("click", () => {
  if (!dropzone.classList.contains("busy")) fileInput.click();
});
dropzone.addEventListener("keydown", (e: KeyboardEvent) => {
  if ((e.key === "Enter" || e.key === " ") && !dropzone.classList.contains("busy")) {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (file) importFile(file);
});

dropzone.addEventListener("dragover", (e: DragEvent) => {
  e.preventDefault();
  if (!dropzone.classList.contains("busy")) dropzone.classList.add("drag-over");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", (e: DragEvent) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  if (dropzone.classList.contains("busy")) return;
  const file = e.dataTransfer?.files?.[0];
  if (file) importFile(file);
});

window.addEventListener("message", (event: MessageEvent) => {
  // From the render iframe: extracted layer JSON (or an extraction error).
  if (event.data?.source === "mrclaude-extractor") {
    if (event.source !== renderFrame.contentWindow) return;
    const { layers, error } = event.data;
    if (error || !layers?.length) {
      setStatus(error || "No importable elements found in that file.", "error");
      setBusy(false);
      return;
    }
    sendToFigma(layers).catch((err: Error) => {
      setStatus(err.message, "error");
      setBusy(false);
    });
    return;
  }

  // From the Figma plugin thread.
  const msg = event.data.pluginMessage;
  if (!msg) return;
  if (msg.type === "import-done") {
    setStatus(`Done — created ${msg.count} layer(s).`, "success");
    setBusy(false);
  }
  if (msg.type === "import-error") {
    setStatus(msg.message, "error");
    setBusy(false);
  }
});
