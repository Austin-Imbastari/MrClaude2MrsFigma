var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { hasChildren } from "../helpers.js";
export function traverseLayers(layer, cb, parent = null) {
    return __awaiter(this, void 0, void 0, function* () {
        if (layer) {
            yield cb(layer, parent);
        }
        if (hasChildren(layer)) {
            for (const child of layer.children) {
                yield traverseLayers(child, cb, layer);
            }
        }
    });
}
