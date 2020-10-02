export type Tuple<T extends Array<any>> = T;
export const tuple = <T extends Array<any>>(...t: T): T => t;

export type Prepend<F, T extends Array<any>> = [F, ...T];
export const prepend = <F>(f: F) => <T extends Array<any>>(t: T): Prepend<F, T> => [
  f,
  ...t,
];
