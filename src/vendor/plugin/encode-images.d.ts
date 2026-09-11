/**
 * Figma's `figma.createImage()` only accepts PNG, JPEG and GIF. We therefore need to transform webp images.
 * This code is borrowed from https://www.figma.com/plugin-docs/working-with-images/
 */
export declare const transformWebpToPNG: (bytes: Uint8Array) => Promise<Uint8Array>;
