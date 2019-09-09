import { Prepend, Concat, Reverse } from 'typescript-tuple';

/* eslint-disable fp/no-mutating-methods */

type Tuple = Array<any>;

export const concat = <X extends Tuple>(x: X) => <T extends Tuple>(
  tuple: T,
): Concat<T, X> => (tuple.concat(x) as unknown) as Concat<T, X>;

export const prepend = <X>(x: X) => <T extends Tuple>(tuple: T): Prepend<T, X> =>
  [x, ...tuple] as Prepend<T, X>;

export const reverse = <T extends Tuple>(tuple: T): Reverse<T> =>
  tuple.reverse() as Reverse<T>;
