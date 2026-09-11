/// <reference types="plugin-typings" />
export declare const buildTextNode: ({ node, }: {
    node: Node;
}) => (Partial<TextNode> & {
    ref?: Element | Node | undefined;
}) | undefined;
