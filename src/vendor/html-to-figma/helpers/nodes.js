export const hasChildren = (node) => node && Array.isArray(node.children);
export function traverse(layer, cb, parent) {
    if (layer) {
        cb(layer, parent);
        if (hasChildren(layer)) {
            layer.children.forEach((child) => traverse(child, cb, layer));
        }
    }
}
export function textNodesUnder(el) {
    let n = null;
    const a = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    while ((n = walk.nextNode())) {
        a.push(n);
    }
    return a;
}
export function isHidden(element) {
    let el = element;
    do {
        const computed = getComputedStyle(el);
        if (
        // computed.opacity === '0' ||
        computed.display === "none" ||
            computed.visibility === "hidden") {
            return true;
        }
        // Some sites hide things by having overflow: hidden and height: 0, e.g. dropdown menus that animate height in
        if (computed.overflow !== "visible" &&
            el.getBoundingClientRect().height < 1) {
            return true;
        }
    } while ((el = el.parentElement));
    return false;
}
export function getParents(node) {
    let el = node instanceof Node && node.nodeType === Node.TEXT_NODE
        ? node.parentElement
        : node;
    const parents = [];
    while (el && (el = el.parentElement)) {
        parents.push(el);
    }
    return parents;
}
export function getDepth(node) {
    return getParents(node).length;
}
