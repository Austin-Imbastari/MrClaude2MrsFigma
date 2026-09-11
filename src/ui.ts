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
