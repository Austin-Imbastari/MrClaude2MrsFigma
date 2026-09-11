/// <reference types="plugin-typings" />
import { WithRef } from "../types/nodes";
export declare const getLayersForFrames: ({ root, layers, }: {
    root: WithRef<FrameNode>;
    layers: WithRef<FrameNode | RectangleNode | TextNode | import("../types/nodes").SvgNode>[];
}) => WithRef<FrameNode>[];
