export const hasChildren = (node) => !!(node && node.children);
export const isGroupNode = (node) => !!(node && node.type === "GROUP");
export const getLayout = (node) => {
    var _a;
    // Simple single layer group wrapping we can ignore
    if (isGroupNode(node) && ((_a = node.children) === null || _a === void 0 ? void 0 : _a.length) === 1) {
        return "column";
    }
    if (node.layoutMode === "VERTICAL") {
        return "column";
    }
    if (node.layoutMode === "HORIZONTAL") {
        return "row";
    }
    return "unknown";
};
