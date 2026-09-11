/// <reference types="plugin-typings" />
export declare type WithRef<T> = Partial<T> & {
    ref?: Element | Node;
};
export declare type LayerNode = WithRef<RectangleNode | TextNode | FrameNode | SvgNode>;
export interface SvgNode extends DefaultShapeMixin, ConstraintMixin {
    type: "SVG";
    svg: string;
}
