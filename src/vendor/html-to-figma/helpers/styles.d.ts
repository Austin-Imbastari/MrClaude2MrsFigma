/// <reference types="plugin-typings" />
import { LayerNode, WithRef } from "../types/nodes";
import { Dimensions, Direction } from "./dimensions";
export declare function getAppliedComputedStyles(element: Element, pseudo?: string): {
    [key: string]: string;
};
export declare function addConstraints(layers: LayerNode[]): void;
export declare const getBorderRadii: ({ computedStyle, }: {
    computedStyle: CSSStyleDeclaration;
}) => Partial<Pick<RectangleNode, "topLeftRadius" | "topRightRadius" | "bottomLeftRadius" | "bottomRightRadius">>;
export declare function getStrokesRectangle({ dir, rect, computedStyle, el, }: {
    dir: Direction;
    rect: Dimensions;
    computedStyle: CSSStyleDeclaration;
    el: Element;
}): WithRef<RectangleNode> | undefined;
export declare const addStrokesFromBorder: ({ computedStyle: { border }, }: {
    computedStyle: CSSStyleDeclaration;
}) => Pick<RectangleNode, "strokes" | "strokeWeight"> | undefined;
export declare const getShadowEffects: ({ computedStyle: { boxShadow }, }: {
    computedStyle: CSSStyleDeclaration;
}) => ShadowEffect[] | undefined;
