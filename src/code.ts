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
