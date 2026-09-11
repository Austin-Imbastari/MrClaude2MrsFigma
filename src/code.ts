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
