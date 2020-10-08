type _Object = Record<string, unknown>;

export type Merge<A extends _Object, B extends _Object> = {
  [I in Exclude<keyof A, keyof B>]: A[I];
} &
  B;
export const merge = <A extends _Object, B extends _Object>(a: A, b: B): Merge<A, B> => ({
  ...a,
  ...b,
});

export { _Object as Object };
