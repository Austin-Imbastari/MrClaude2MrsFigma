export declare type Direction = "left" | "right" | "top" | "bottom";
export interface Dimensions extends Pick<DOMRect, "top" | "left" | "bottom" | "width" | "right" | "height"> {
}
export declare function getBoundingClientRect(el: Element): Dimensions;
