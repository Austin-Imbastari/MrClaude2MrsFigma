export interface Unit {
    unit: "PIXELS";
    value: number;
}
export declare const parseUnits: (str?: string | null | undefined) => Unit | null;
export declare function getRgb(colorString?: string | null): {
    r: number;
    g: number;
    b: number;
    a: number;
} | null;
interface ParsedBoxShadow {
    inset: boolean;
    offsetX: number;
    offsetY: number;
    blurRadius: number;
    spreadRadius: number;
    color: string;
}
export declare const parseBoxShadowStr: (str: string) => ParsedBoxShadow;
export {};
