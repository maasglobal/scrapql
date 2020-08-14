export type MergeObject<A extends object, B extends object> = {
  [I in Exclude<keyof A, keyof B>]: A[I];
} &
  B;
export const mergeObject = <A extends object, B extends object>(
  a: A,
  b: B & { [I in keyof A]?: never },
): MergeObject<A, B> => ({ ...a, ...b });
