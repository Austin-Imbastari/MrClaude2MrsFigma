export const fastClone = (obj) => typeof obj === "symbol" ? null : JSON.parse(JSON.stringify(obj));
