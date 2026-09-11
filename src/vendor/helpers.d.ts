/// <reference types="plugin-typings" />
export declare const hasChildren: (node: unknown) => node is ChildrenMixin;
export declare const isGroupNode: (node: unknown) => node is GroupNode;
export declare const getLayout: (node: SceneNode) => "column" | "row" | "unknown";
