/// <reference types="plugin-typings" />
export declare function traverseLayers(layer: SceneNode, cb: (layer: SceneNode, parent: BaseNode | null) => void, parent?: BaseNode | null): Promise<void>;
