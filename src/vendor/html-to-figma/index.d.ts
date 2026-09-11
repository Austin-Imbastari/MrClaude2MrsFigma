/// <reference types="plugin-typings" />
import { WithRef } from "./types/nodes";
export declare function htmlToFigma(selector?: HTMLElement | string, useFrames?: boolean, time?: boolean): WithRef<FrameNode | RectangleNode | TextNode | import("./types/nodes").SvgNode>[];
