import { sequenceT } from 'fp-ts/lib/Apply';
import { sequenceS } from 'fp-ts/lib/Apply';
import { array } from 'fp-ts/lib/Array';
import * as Array_ from 'fp-ts/lib/Array';
import * as boolean_ from 'fp-ts/lib/boolean';
import { Either, either } from 'fp-ts/lib/Either';
import * as Either_ from 'fp-ts/lib/Either';
import { Eq } from 'fp-ts/lib/Eq';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';
import { Task, task } from 'fp-ts/lib/Task';
import { TaskEither, taskEither } from 'fp-ts/lib/TaskEither';
import * as t from 'io-ts';

export const Dict = <KeyC extends t.Mixed, ValueC extends t.Mixed>(
  K: KeyC,
  V: ValueC,
): t.ArrayC<t.TupleC<[KeyC, ValueC]>> => t.array(t.tuple([K, V]));
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

export function sequenceKVTaskEither<K, E, V>([k, v]: [K, TaskEither<E, V>]): TaskEither<
  E,
  [K, V]
> {
  return sequenceT(taskEither)(taskEither.of(k), v);
}
export function sequenceTaskEither<K, E, V>(
  dict: Dict<K, TaskEither<E, V>>,
): TaskEither<E, Dict<K, V>> {
  return pipe(dict, Array_.map(sequenceKVTaskEither), array.sequence(taskEither));
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
function reduceDuplicateKeys<T>(eq: Eq<T>): (dupes: NonEmptyArray<T>) => Option<T> {
  return (duplicates) =>
    pipe(
      duplicates,
      Array_.uniq(eq),
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
}

// See https://github.com/gcanti/fp-ts/pull/1367
export function transpose<A>(
  xy: NonEmptyArray<NonEmptyArray<A>>,
): NonEmptyArray<NonEmptyArray<A>>;
export function transpose<A>(xy: Array<Array<A>>): Array<NonEmptyArray<A>>;
export function transpose<A>(xy: Array<Array<A>>): Array<NonEmptyArray<A>> {
  /* eslint-disable fp/no-mutation,fp/no-loops,fp/no-let,prefer-const */
  const maxX = xy.length;
  const maxY = Math.max(...xy.map((y) => y.length));
  const yx: Array<Array<A>> = [];
  let yi = 0;
  for (; yi < maxY; yi++) {
    let xi = 0;
    let x: Array<A> = [];
    for (; xi < maxX; xi++) {
      const y: any = xy[xi];
      if (yi < y.length) {
        x.push(y[yi]);
      }
    }
    yx.push(x);
  }
  return (yx as unknown) as any;
}

const mergeTransposed = <E, K, A, B>(
  reduceValues: (vs: NonEmptyArray<A>) => Either<E, B>,
) => (dicts: Dict<K, NonEmptyArray<A>>): Either<E, Dict<K, B>> =>
  pipe(
    dicts,
    Array_.map(([key, variants]) =>
      pipe(
        reduceValues(variants),
        Either_.map((b): [K, B] => [key, b]),
      ),
    ),
    array.sequence(either),
  );

export const mergeSymmetric = <E, K, A, B>(
  eq: Eq<K>,
  keyMismatch: () => E,
  reduceValues: (vs: NonEmptyArray<A>) => Either<E, B>,
) => (dicts: NonEmptyArray<Dict<K, A>>): Either<E, Dict<K, B>> => {
  const transposed = transpose(dicts);
  if (transposed.some((variants) => variants.length !== dicts.length)) {
    return Either_.left(keyMismatch());
  }
  return pipe(
    transposed,
    Array_.map((variants) =>
      pipe(
        {
          k: pipe(
            variants,
            NonEmptyArray_.map(([k, _a]) => k),
            reduceDuplicateKeys(eq),
            Either_.fromOption(keyMismatch),
          ),
          az: pipe(
            variants,
            NonEmptyArray_.map(([_k, a]) => a),
            Either_.right,
          ),
        },
        sequenceS(either),
        Either_.map(({ k, az }): [K, NonEmptyArray<A>] => [k, az]),
      ),
    ),
    array.sequence(either),
    Either_.chain(mergeTransposed(reduceValues)),
  );
};

function sortAndTranspose<K extends string, A>(
  dicts: NonEmptyArray<Dict<K, A>>,
): Dict<K, NonEmptyArray<A>> {
  const lastDict = Object.fromEntries(NonEmptyArray_.last(dicts));

  const tmp: Record<string, NonEmptyArray<A>> = {};
  dicts.forEach((dict) =>
    dict.forEach(([k, a]) => {
      if (lastDict.hasOwnProperty(k)) {
        const values = tmp[k];
        if (values) {
          values.push(a);
        } else {
          tmp[k] = [a];
        }
      }
    }),
  );
  return Object.entries(tmp) as Dict<K, NonEmptyArray<A>>;
}

export const mergeAsymmetric = <E, K extends string, A, B>(
  reduceValues: (vs: NonEmptyArray<A>) => Either<E, B>,
) => (dicts: NonEmptyArray<Dict<K, A>>): Either<E, Dict<K, B>> =>
  pipe(sortAndTranspose(dicts), mergeTransposed(reduceValues));

export const rewireDict = {
  reduceDuplicateKeys,
  transpose,
  sortAndTranspose,
};
