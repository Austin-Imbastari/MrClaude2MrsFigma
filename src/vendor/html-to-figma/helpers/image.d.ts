/// <reference types="plugin-typings" />
interface ImagePaintWithUrl extends ImagePaint {
    url: string;
}
export declare const getImagePaintWithUrl: ({ computedStyle, el, }: {
    computedStyle: CSSStyleDeclaration;
    el: Element;
}) => ImagePaintWithUrl | undefined;
export {};
