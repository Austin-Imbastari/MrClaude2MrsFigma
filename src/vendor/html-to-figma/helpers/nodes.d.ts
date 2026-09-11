/// <reference types="plugin-typings" />
import { LayerNode } from "../types/nodes";
export declare const hasChildren: (node: import("../types/nodes").WithRef<FrameNode | RectangleNode | TextNode | import("../types/nodes").SvgNode>) => node is ChildrenMixin;
export declare function traverse(layer: LayerNode, cb: (layer: LayerNode, parent?: LayerNode | null) => void, parent?: LayerNode | null): void;
export declare function textNodesUnder(el: Element): Node[];
export declare function isHidden(element: Element): boolean;
export declare function getParents(node: Element | Node): Element[];
export declare function getDepth(node: Element | Node): number;
