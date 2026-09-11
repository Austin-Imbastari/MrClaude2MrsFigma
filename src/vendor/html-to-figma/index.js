import { getBoundingClientRect } from "./helpers/dimensions.js";
import { getImagePaintWithUrl } from "./helpers/image.js";
import { isHidden, textNodesUnder, traverse } from "./helpers/nodes.js";
import { size } from "./helpers/object.js";
import { getRgb } from "./helpers/parsers.js";
import { addStrokesFromBorder, getStrokesRectangle, getAppliedComputedStyles, getShadowEffects, getBorderRadii, } from "./helpers/styles.js";
import { createSvgLayer, processSvgUseElements } from "./helpers/svg.js";
import { buildTextNode } from "./helpers/text.js";
import { getLayersForFrames } from "./helpers/frames.js";
const generateElements = (el) => {
    const getShadowEls = (el) => {
        var _a;
        return Array.from(((_a = el.shadowRoot) === null || _a === void 0 ? void 0 : _a.querySelectorAll("*")) || []).reduce((memo, el) => [...memo, el, ...getShadowEls(el)], []);
    };
    const els = Array.from(el.querySelectorAll("*")).reduce((memo, el) => [...memo, el, ...getShadowEls(el)], []);
    return els;
};
function removeRefs({ layers, root, }) {
    layers.concat([root]).forEach((layer) => {
        traverse(layer, (child) => {
            delete child.ref;
        });
    });
}
const getLayersForElement = (el) => {
    const elementLayers = [];
    if (isHidden(el)) {
        return [];
    }
    if (el instanceof SVGSVGElement) {
        elementLayers.push(createSvgLayer(el));
        return elementLayers;
    }
    // Sub SVG Eleemnt
    else if (el instanceof SVGElement) {
        return [];
    }
    // for `picture`, we only need the `image` element. We can ignore the parent `picture` and
    // `source` sibling elements.
    if ((el.parentElement instanceof HTMLPictureElement &&
        el instanceof HTMLSourceElement) ||
        el instanceof HTMLPictureElement) {
        return [];
    }
    // TO-DO: what does `appliedStyles` do here? All we do is check that it's non-empty
    const appliedStyles = getAppliedComputedStyles(el);
    const computedStyle = getComputedStyle(el);
    if ((size(appliedStyles) ||
        el instanceof HTMLImageElement ||
        el instanceof HTMLVideoElement) &&
        computedStyle.display !== "none") {
        const rect = getBoundingClientRect(el);
        if (rect.width >= 1 && rect.height >= 1) {
            const fills = [];
            const color = getRgb(computedStyle.backgroundColor);
            if (color) {
                const solidPaint = {
                    type: "SOLID",
                    color: {
                        r: color.r,
                        g: color.g,
                        b: color.b,
                    },
                    opacity: color.a || 1,
                };
                fills.push(solidPaint);
            }
            const rectNode = {
                type: "RECTANGLE",
                ref: el,
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                fills,
            };
            const strokes = addStrokesFromBorder({ computedStyle });
            if (strokes) {
                Object.assign(rectNode, strokes);
            }
            if (!rectNode.strokes) {
                for (const dir of ["top", "left", "right", "bottom"]) {
                    const strokesLayer = getStrokesRectangle({
                        dir,
                        rect,
                        computedStyle,
                        el,
                    });
                    if (strokesLayer) {
                        elementLayers.push(strokesLayer);
                    }
                }
            }
            const imagePaint = getImagePaintWithUrl({ computedStyle, el });
            if (imagePaint) {
                fills.push(imagePaint);
                rectNode.name = "IMAGE";
            }
            const shadowEffects = getShadowEffects({ computedStyle });
            if (shadowEffects) {
                rectNode.effects = shadowEffects;
            }
            const borderRadii = getBorderRadii({ computedStyle });
            Object.assign(rectNode, borderRadii);
            elementLayers.push(rectNode);
        }
    }
    return elementLayers;
};
export function htmlToFigma(selector = "body", useFrames = false, time = false) {
    if (time) {
        console.time("Parse dom");
    }
    const layers = [];
    const el = selector instanceof HTMLElement
        ? selector
        : document.querySelector(selector || "body");
    if (el) {
        processSvgUseElements(el);
        const els = generateElements(el);
        els.forEach((el) => {
            const elLayers = getLayersForElement(el);
            layers.push(...elLayers);
        });
        const textNodes = textNodesUnder(el);
        for (const node of textNodes) {
            const textNode = buildTextNode({ node });
            if (textNode) {
                layers.push(textNode);
            }
        }
    }
    // TODO: send frame: { children: []}
    const root = {
        type: "FRAME",
        width: Math.round(window.innerWidth),
        height: Math.round(document.documentElement.scrollHeight),
        x: 0,
        y: 0,
        ref: document.body,
    };
    layers.unshift(root);
    const framesLayers = useFrames
        ? getLayersForFrames({ layers, root })
        : layers;
    removeRefs({ layers: framesLayers, root });
    if (time) {
        console.info("\n");
        console.timeEnd("Parse dom");
    }
    return framesLayers;
}
