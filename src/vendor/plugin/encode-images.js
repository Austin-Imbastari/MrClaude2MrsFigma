var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * Figma's `figma.createImage()` only accepts PNG, JPEG and GIF. We therefore need to transform webp images.
 * This code is borrowed from https://www.figma.com/plugin-docs/working-with-images/
 */
export const transformWebpToPNG = (bytes) => __awaiter(void 0, void 0, void 0, function* () {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const imageData = yield decode(canvas, ctx, bytes);
    const newBytes = yield encode(canvas, ctx, imageData);
    return newBytes;
});
// Encoding an image is also done by sticking pixels in an
// HTML canvas and by asking the canvas to serialize it into
// an actual PNG file via canvas.toBlob().
function encode(canvas, ctx, imageData) {
    ctx.putImageData(imageData, 0, 0);
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result));
            reader.onerror = () => reject(new Error("Could not read from blob"));
            reader.readAsArrayBuffer(blob);
        });
    });
}
// Decoding an image can be done by sticking it in an HTML
// canvas, as we can read individual pixels off the canvas.
function decode(canvas, ctx, bytes) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = URL.createObjectURL(new Blob([bytes]));
        const image = yield new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject();
            img.src = url;
        });
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, image.width, image.height);
        return imageData;
    });
}
