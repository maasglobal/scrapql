import * as t from 'io-ts';

import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { Task, task } from 'fp-ts/lib/Task';
import { Either, either } from 'fp-ts/lib/Either';
import { Option, option } from 'fp-ts/lib/Option';
import { sequenceT } from 'fp-ts/lib/Apply';
import { array } from 'fp-ts/lib/Array';
import * as Option_ from 'fp-ts/lib/Option';
import * as Array_ from 'fp-ts/lib/Array';
import * as boolean_ from 'fp-ts/lib/boolean';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { sequenceS } from 'fp-ts/lib/Apply';
import { pipe } from 'fp-ts/lib/pipeable';

export const Dict = <KeyC extends t.Mixed, ValueC extends t.Mixed>(K: KeyC, V: ValueC) =>
  t.array(t.tuple([K, V]));
export type Dict<K, V> = Array<[K, V]>;
export const dict = <K, V>(...d: Dict<K, V>): Dict<K, V> => d;

export function mapWithIndex<K, A, B>(
  f: (k: K, a: A) => B,
): (fa: Dict<K, A>) => Dict<K, B> {
  return (fa: Dict<K, A>) =>
    pipe(
      fa,
      Array_.map(([k, v]) => [k, f(k, v)]),
    );
}

export function sequenceKVTask<K, V>([k, v]: [K, Task<V>]): Task<[K, V]> {
  return sequenceT(task)(task.of(k), v);
}

export function sequenceTask<K, V>(dict: Dict<K, Task<V>>): Task<Dict<K, V>> {
  return pipe(dict, Array_.map(sequenceKVTask), array.sequence(task));
}

export function sequenceKVEither<K, V, E>([k, v]: [K, Either<E, V>]): Either<E, [K, V]> {
  return sequenceT(either)(either.of(k), v);
}

export function sequenceEither<K, V, E>(
  dict: Dict<K, Either<E, V>>,
): Either<E, Dict<K, V>> {
  return pipe(dict, Array_.map(sequenceKVEither), array.sequence(either));
}

export function lookup<K>(k: K) {
  return <V>(dict: Dict<K, V>): Option<V> =>
    pipe(
      dict,
      Array_.findFirst(([ki, _v]) => ki === k),
      Option_.map(([_k, v]) => v),
    );
}

export function keys<K>(dict: Dict<K, unknown>): Array<K> {
  return pipe(
    dict,
    Array_.map(([k, _v]) => k),
  );
}

export function values<V>(dict: Dict<unknown, V>): Array<V> {
  return pipe(
    dict,
    Array_.map(([_k, v]) => v),
  );
}

// returns Some if all values are equal or None if some values differ
const reduceDuplicateKeys = <T>(duplicates: NonEmptyArray<T>): Option<T> =>
  pipe(
    duplicates,
    Array_.uniq({
      equals: (a: T, b: T) => a === b,
    }),
    NonEmptyArray_.fromArray,
    Option_.chain(
      ([k, ...ks]: NonEmptyArray<T>): Option<T> =>
        pipe(
          ks.length === 0,
          boolean_.fold(
            () => Option_.none,
            () => Option_.some(k),
          ),
        ),
    ),
  );

const transpose = <A>(outer: NonEmptyArray<Array<A>>): Array<NonEmptyArray<A>> =>
  pipe(
    NonEmptyArray_.head(outer),
    Array_.mapWithIndex((i, first) =>
      NonEmptyArray_.cons(
        first,
        pipe(
          NonEmptyArray_.tail(outer),
          Array_.filterMap((inner) => Option_.fromNullable(inner[i])),
        ),
      ),
    ),
  );

export const mergeSymmetric = <A, B>(
  reduceValues: (vs: NonEmptyArray<A>) => Option<B>,
) => <K>(dicts: NonEmptyArray<Dict<K, A>>): Option<Dict<K, B>> =>
  pipe(
    dicts,
    transpose,
    Array_.map(
      (variants: NonEmptyArray<[K, A]>): Option<[K, B]> =>
        pipe(
          {
            k: pipe(
              variants,
              NonEmptyArray_.map(([k, _v]) => k),
              reduceDuplicateKeys,
            ),
            v: pipe(
              variants,
              NonEmptyArray_.map(([_k, v]) => v),
              reduceValues,
            ),
          },
          sequenceS(option),
          Option_.map(({ k, v }) => [k, v]),
        ),
    ),
    array.sequence(option),
  );

export const rewireDict = {
  reduceDuplicateKeys,
  transpose,
};
