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

  // Bundled separately and inlined into ui.ts, which injects it into the render
  // iframe so the extraction engine runs in the iframe's own JS realm.
  const extractorBuild = await esbuild.build({
    entryPoints: ["src/extractor.ts"],
    bundle: true,
    write: false,
    target: "es2020",
  });

  const uiBuild = await esbuild.build({
    entryPoints: ["src/ui.ts"],
    bundle: true,
    write: false,
    target: "es2020",
    define: {
      __EXTRACTOR_SCRIPT__: JSON.stringify(extractorBuild.outputFiles[0].text),
    },
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
