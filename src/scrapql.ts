import { array } from 'fp-ts/lib/Array';
import * as Array_ from 'fp-ts/lib/Array';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as Apply_ from 'fp-ts/lib/Apply';
import * as Record_ from 'fp-ts/lib/Record';
import { Task, task, taskSeq } from 'fp-ts/lib/Task';
import * as Task_ from 'fp-ts/lib/Task';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';
import { identity } from 'fp-ts/lib/function';

// fields result contains part of the payload

type FieldsReporter<D, R, K extends Array<string>> = (d: D, r: R, ...k: K) => Task<void>;
export type FieldsResultProcessor<D, R, K extends Array<string>> = (d: D, r: R, ...k: K) => Task<void>;

function processResultFields<D, R, K extends Array<string>>(
  reporter: FieldsReporter<D, R, K>,
): FieldsResultProcessor<D, R, K> {
  return (driver, result, ...keys) => reporter(driver, result, ...keys);
}

// keys result contains data that always exists in data source

type KeysReporter<D, R, K extends Array<string>> = (d: D, r: R, i: string, ...k: K) => Task<void>;
export type KeysResultProcessor<D, R, K extends Array<string>> = (d: D, r: R, ...k: K) => Task<void>;

function processResultKeys<D, V, K extends Array<string>>(
  reporter: KeysReporter<D, V, K>,
): KeysResultProcessor<D, Record<string, V>, K> {
  return (driver: D, result: Record<string, V>, ...keys: K) => {
    const entries = Object.entries(result);
    const reporters: Array<Task<void>> = entries.map(([id, subResult]) => reporter(driver, subResult, id, ...keys));
    return Foldable_.traverse_(taskSeq, array)(reporters, identity);
  };
}

// ids result contains data that may not exist in data source

type IdsReporter<D, R, K extends Array<string>> = KeysReporter<D, R, K>;
type ExistenceReporter<D> = (d: D, i: string, b: boolean) => Task<void>;
export type IdsResultProcessor<D, R, K extends Array<string>> = KeysResultProcessor<D, R, K>;

function processResultIds<D, V, K extends Array<string>>(
  reporter: IdsReporter<D, V, K>,
  existenceReporter: ExistenceReporter<D>,
): KeysResultProcessor<D, Record<string, Option<V>>, K> {
  return (driver: D, result: Record<string, Option<V>>, ...keys: K) => {
    const entries = Object.entries(result);
    const reporters: Array<Task<void>> = Array_.flatten(
      entries.map(([id, maybeSubResult]) =>
        pipe(
          maybeSubResult,
          Option_.fold(
            () => [existenceReporter(driver, id, false)],
            (subResult) => [existenceReporter(driver, id, true), reporter(driver, subResult, id, ...keys)],
          ),
        ),
      ),
    );
    return Foldable_.traverse_(taskSeq, array)(reporters, identity);
  };
}

// properties result contains results for a set of optional query fields

export type ResultPropertyHelper<D, R, K extends Array<string>> = <B extends R[keyof R]>(
  o: Option<B>,
  r: (d: D, b: B, ...keys: K) => Task<void>,
) => Array<Task<void>>;

type PropertiesResultReporter<D, R, K extends Array<string>> = (
  r: R,
  h: ResultPropertyHelper<D, R, K>,
) => Array<Task<void>>;

export type PropertiesResultProcessor<D, R, K extends Array<string>> = (d: D, r: R, ...k: K) => Task<void>;

function processResultProperties<D, R, K extends Array<string>>(
  reporter: PropertiesResultReporter<D, R, K>,
): PropertiesResultProcessor<D, R, K> {
  return (driver: D, result: R, ...keys: K) => {
    const helper: ResultPropertyHelper<D, R, K> = (maybeSubResult, processor) =>
      pipe(
        maybeSubResult,
        Option_.fold(() => [], (subResult) => [processor(driver, subResult, ...keys)]),
      );
    const tasks: Array<Task<void>> = reporter(result, helper);
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}

// fields query contains information for retrieving a payload

type FieldsQueryResolver<D, K extends Array<string>, R> = (d: D, ...k: K) => Task<R>;
export type FieldsQueryProcessor<D, K extends Array<string>, R> = (d: D, q: true, ...k: K) => Task<R>;

function processQueryFields<D, K extends Array<string>, R>(
  resolver: FieldsQueryResolver<D, K, R>,
): FieldsQueryProcessor<D, K, R> {
  return (driver, query, ...keys) => resolver(driver, ...keys);
}

// keys query requests some information that is always present in data source

type KeysQueryResolver<D, Q extends Record<string, any>, K extends Array<string>, R> = (
  p: D,
  s: Q[keyof Q],
  i: string,
  ...k: K
) => Task<R>;
export type KeysQueryProcessor<D, Q, K extends Array<string>, R> = (d: D, q: Q, ...k: K) => Task<Record<string, R>>;

function processQueryKeys<D, Q extends Record<string, any>, K extends Array<string>, R>(
  resolver: KeysQueryResolver<D, Q, K, R>,
): KeysQueryProcessor<D, Q, K, R> {
  return (driver: D, query: Q, ...keys: K) => {
    return pipe(
      query,
      Record_.mapWithIndex((id, subQuery: Q[keyof Q]) => resolver(driver, subQuery, id, ...keys)),
      Apply_.sequenceS(task),
    );
  };
}

// keys query requests some information that may not be present in data source

type IdsQueryResolver<D, Q, K extends Array<string>, R> = KeysQueryResolver<D, Q, K, R>;
type ExistenceCheck<D> = (d: D, i: string) => Task<boolean>;
export type IdsQueryProcessor<D, Q, K extends Array<string>, R> = KeysQueryProcessor<D, Q, K, Option<R>>;

function processQueryIds<D, Q extends Record<string, any>, K extends Array<string>, R>(
  resolver: IdsQueryResolver<D, Q, K, R>,
  existenceCheck: ExistenceCheck<D>,
): IdsQueryProcessor<D, Q, K, R> {
  return (driver: D, query: Q, ...keys: K) => {
    return pipe(
      query,
      Record_.mapWithIndex((id, subQuery: Q[keyof Q]) => {
        return pipe(
          existenceCheck(driver, id),
          Task_.chain(
            (exists): Task<Option<R>> => {
              if (exists) {
                return pipe(
                  resolver(driver, subQuery, id, ...keys),
                  Task_.map(Option_.some),
                );
              }
              return Task_.of(Option_.none);
            },
          ),
        );
      }),
      Apply_.sequenceS(task),
    );
  };
}

// properties query contains optional queries that may or may not be present

export type QueryPropertyHelper<D, Q, K extends Array<string>, R> = <
  I extends keyof Q & keyof R,
  A extends Q[I],
  B extends R[I]
>(
  p: I,
  o: Option<A>,
  r: (d: D, x: A, ...k: K) => Task<B>,
) => { readonly [i in I]?: Task<B> };

type PropertiesQueryResolver<D, Q, K extends Array<string>, R> = (
  q: Q,
  h: QueryPropertyHelper<D, Q, K, R>,
) => { readonly [I in keyof R]: Task<R[I]> };

export type PropertiesQueryProcessor<D, Q, K extends Array<string>, R> = (d: D, q: Q, ...k: K) => Task<R>;

function processQueryProperties<D, Q, K extends Array<string>, R>(
  resolver: PropertiesQueryResolver<D, Q, K, R>,
): PropertiesQueryProcessor<D, Q, K, R> {
  return (driver: D, query: Q, ...keys: K) => {
    const helper: QueryPropertyHelper<D, Q, K, R> = (key, maybeSubQuery, processor) =>
      pipe(
        maybeSubQuery,
        Option_.fold(() => ({} as any), (subQuery) => ({ [key]: processor(driver, subQuery, ...keys) })),
      );
    // todo: convince sequenceS to process tasks with type casts
    const tasks: any = resolver(query, helper);
    return (Apply_.sequenceS(task)(tasks) as unknown) as Task<R>;
  };
}

const process = {
  processResultFields,
  processResultKeys,
  processResultIds,
  processResultProperties,
  processQueryFields,
  processQueryKeys,
  processQueryIds,
  processQueryProperties,
};

export default process;
