export declare const processSvgUseElements: (el: Element) => void;
export declare const createSvgLayer: (el: SVGSVGElement) => Partial<import("../types/nodes").SvgNode> & {
    ref?: Element | Node | undefined;
};
