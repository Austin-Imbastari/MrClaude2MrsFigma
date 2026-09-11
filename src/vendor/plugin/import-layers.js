var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { traverseLayers } from "./traverse-layers.js";
function processImages(layer) {
    return __awaiter(this, void 0, void 0, function* () {
        const images = getImageFills(layer);
        return (images &&
            Promise.all(images.map((image) => __awaiter(this, void 0, void 0, function* () {
                if (image === null || image === void 0 ? void 0 : image.intArr) {
                    image.imageHash = yield figma.createImage(image.intArr).hash;
                    delete image.intArr;
                }
            }))));
    });
}
function getImageFills(layer) {
    const images = Array.isArray(layer.fills) &&
        layer.fills.filter((item) => item.type === "IMAGE");
    return images;
}
const normalizeName = (str) => str.toLowerCase().replace(/[^a-z]/gi, "");
const defaultFont = { family: "Inter", style: "Regular" };
// TODO: keep list of fonts not found
function getMatchingFont(fontStr, availableFonts) {
    return __awaiter(this, void 0, void 0, function* () {
        const familySplit = fontStr.split(/\s*,\s*/);
        for (const family of familySplit) {
            const normalized = normalizeName(family);
            for (const availableFont of availableFonts) {
                const normalizedAvailable = normalizeName(availableFont.fontName.family);
                if (normalizedAvailable === normalized) {
                    const cached = fontCache[normalizedAvailable];
                    if (cached) {
                        return cached;
                    }
                    yield figma.loadFontAsync(availableFont.fontName);
                    fontCache[fontStr] = availableFont.fontName;
                    fontCache[normalizedAvailable] = availableFont.fontName;
                    return availableFont.fontName;
                }
            }
        }
        return defaultFont;
    });
}
const fontCache = {};
function assign(a, b) {
    for (const key in b) {
        const value = b[key];
        if (typeof value != "undefined" &&
            ["width", "height", "type", "ref", "children", "svg"].indexOf(key) === -1) {
            try {
                a[key] = b[key];
            }
            catch (err) {
                console.warn(`Assign error for property "${key}"`, a, b, err);
            }
        }
    }
}
export function importLayers(layers) {
    return __awaiter(this, void 0, void 0, function* () {
        const availableFonts = (yield figma.listAvailableFontsAsync()).filter((font) => font.fontName.style === "Regular");
        yield figma.loadFontAsync(defaultFont);
        const rects = [];
        const topLevelFrames = [];
        let createdCount = 0;
        for (const rootLayer of layers) {
            yield traverseLayers(rootLayer, (layer, parent) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    if (layer.type === "FRAME" || layer.type === "GROUP") {
                        const frame = figma.createFrame();
                        frame.x = layer.x;
                        frame.y = layer.y;
                        frame.resize(layer.width || 1, layer.height || 1);
                        assign(frame, layer);
                        rects.push(frame);
                        ((parent && parent.ref) || figma.currentPage).appendChild(frame);
                        layer.ref = frame;
                        if (!parent) {
                            topLevelFrames.push(frame);
                        }
                    }
                    else if (layer.type === "SVG") {
                        const node = figma.createNodeFromSvg(layer.svg);
                        node.x = layer.x;
                        node.y = layer.y;
                        node.resize(layer.width || 1, layer.height || 1);
                        layer.ref = node;
                        rects.push(node);
                        assign(node, layer);
                        ((parent && parent.ref) || figma.currentPage).appendChild(node);
                    }
                    else if (layer.type === "RECTANGLE") {
                        const rect = figma.createRectangle();
                        if (getImageFills(layer)) {
                            yield processImages(layer);
                        }
                        assign(rect, layer);
                        rect.resize(layer.width || 1, layer.height || 1);
                        rects.push(rect);
                        layer.ref = rect;
                        ((parent && parent.ref) || figma.currentPage).appendChild(rect);
                    }
                    else if (layer.type == "TEXT") {
                        const text = figma.createText();
                        if (layer.fontFamily) {
                            const cached = fontCache[layer.fontFamily];
                            if (cached) {
                                text.fontName = cached;
                            }
                            else {
                                const family = yield getMatchingFont(layer.fontFamily || "", availableFonts);
                                text.fontName = family;
                            }
                            delete layer.fontFamily;
                        }
                        assign(text, layer);
                        layer.ref = text;
                        text.resize(layer.width || 1, layer.height || 1);
                        text.textAutoResize = "HEIGHT";
                        const lineHeight = (layer.lineHeight && layer.lineHeight.value) || layer.height;
                        let adjustments = 0;
                        while (typeof text.fontSize === "number" &&
                            typeof layer.fontSize === "number" &&
                            (text.height > Math.max(layer.height, lineHeight) * 1.2 ||
                                text.width > layer.width * 1.2)) {
                            // Don't allow changing more than ~30%
                            if (adjustments++ > layer.fontSize * 0.3) {
                                console.warn("Too many font adjustments", text, layer);
                                // debugger
                                break;
                            }
                            try {
                                text.fontSize = text.fontSize - 1;
                            }
                            catch (err) {
                                console.warn("Error on resize text:", layer, text, err);
                            }
                        }
                        rects.push(text);
                        ((parent && parent.ref) || figma.currentPage).appendChild(text);
                    }
                }
                catch (err) {
                    console.warn("Error on layer:", layer, err);
                }
            }));
            createdCount++;
        }
        if (topLevelFrames.length) {
            figma.currentPage.selection = topLevelFrames;
        }
        return createdCount;
    });
}
