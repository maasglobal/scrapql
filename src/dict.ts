import * as t from 'io-ts';

import { Task, task } from 'fp-ts/lib/Task';
import { Option } from 'fp-ts/lib/Option';
import { sequenceT } from 'fp-ts/lib/Apply';
import { array } from 'fp-ts/lib/Array';
import * as Option_ from 'fp-ts/lib/Option';
import * as Array_ from 'fp-ts/lib/Array';
import { pipe } from 'fp-ts/lib/pipeable';

export const Dict = <KeyC extends t.Mixed, ValueC extends t.Mixed>(K: KeyC, V: ValueC) =>
  t.array(t.tuple([K, V]));
export type Dict<K, V> = Array<[K, V]>;
export const dict = <D extends Dict<any, any>>(...d: D): D => d;

export function mapWithIndex<K extends string, A, B>(
  f: (k: K, a: A) => B,
): (fa: Dict<K, A>) => Dict<K, B> {
  return (fa: Dict<K, A>) =>
    pipe(
      fa,
      Array_.map(([k, v]) => [k, f(k, v)]),
    );
}

export function sequenceKV<K extends string, V>([k, v]: [K, Task<V>]): Task<[K, V]> {
  return sequenceT(task)(task.of(k), v);
}

export function sequenceTask<K extends string, V>(
  dict: Dict<K, Task<V>>,
): Task<Dict<K, V>> {
  return pipe(
    dict,
    Array_.map(sequenceKV),
    array.sequence(task),
  );
}

export function lookup<K extends string>(k: K) {
  return <V>(dict: Dict<K, V>): Option<V> =>
    pipe(
      dict,
      Array_.findFirst(([ki, _v]) => ki === k),
      Option_.map(([_k, v]) => v),
    );
}

export function keys<K extends string>(dict: Dict<K, unknown>): Array<K> {
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
