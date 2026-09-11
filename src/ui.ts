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
