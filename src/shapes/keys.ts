import * as Array_ from 'fp-ts/lib/Array';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import { Either } from 'fp-ts/lib/Either';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import { Task, taskSeq } from 'fp-ts/lib/Task';
import { array } from 'fp-ts/lib/Array';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';

import * as Context_ from '../utils/onion';
import * as Dict_ from '../utils/dict';
import * as NEGenF_ from '../utils/negf';
import * as Onion_ from '../utils/onion';
import { Dict } from '../utils/dict';
import { Prepend } from '../utils/onion';

import {
  Context,
  Err,
  Examples,
  Key,
  KeyCodec,
  KeysQuery,
  KeysResult,
  Protocol,
  Query,
  QueryProcessor,
  ReduceFailure,
  Reporters,
  Resolvers,
  Result,
  ResultProcessor,
  ResultReducer,
  examples,
  protocol,
  structuralMismatch,
} from '../scrapql';

// keys query requests some information that is always present in database

export function processQuery<
  Q extends KeysQuery<Dict<K, SQ>>,
  E extends Err<any>,
  C extends Context,
  A extends Resolvers<any>,
  K extends Key<any>,
  SQ extends Query<any>,
  SR extends Result<any>
>(
  subProcessor: QueryProcessor<SQ, SR, E, Prepend<K, C>, A>,
): QueryProcessor<Q, KeysResult<Dict<K, SR>>, E, C, A> {
  return (query: Q) => (context: C): ReaderTaskEither<A, E, KeysResult<Dict<K, SR>>> => {
    return (resolvers) =>
      pipe(
        query,
        Dict_.mapWithIndex(
          (key: K, subQuery: SQ): TaskEither<E, SR> => {
            const subContext = pipe(context, Context_.prepend(key));
            return subProcessor(subQuery)(subContext)(resolvers);
          },
        ),
        Dict_.sequenceTaskEither,
      );
  };
}

// keys result contains data that always exists in database

export function processResult<
  R extends KeysResult<Dict<K, SR>>,
  C extends Context,
  A extends Reporters<any>,
  K extends Key<any>,
  SR extends Result<any>
>(subProcessor: ResultProcessor<SR, Prepend<K, C>, A>): ResultProcessor<R, C, A> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters): Task<void> => {
      const tasks: Array<Task<void>> = pipe(
        result,
        Dict_.mapWithIndex((key: K, subResult: SR) => {
          const subContext = pipe(context, Onion_.prepend(key));
          return subProcessor(subResult)(subContext)(reporters);
        }),
        Array_.map(([_k, v]) => v),
      );
      return Foldable_.traverse_(taskSeq, array)(tasks, identity);
    };
  };
}

export const reduceResult = <K extends Key<any>, SR extends Result<any>>(
  reduceSubResult: ResultReducer<SR>,
): ResultReducer<KeysResult<Dict<K, SR>>> => (results) =>
  pipe(
    results,
    Dict_.mergeSymmetric(
      () => structuralMismatch('key'),
      (subResultVariants: NonEmptyArray<SR>): Either<ReduceFailure, SR> =>
        reduceSubResult(subResultVariants),
    ),
  );

export function queryExamples<K extends Key<any>, SQ extends Query<any>>(
  keys: Examples<K>,
  subQueries: Examples<SQ>,
): Examples<KeysQuery<Dict<K, SQ>>> {
  return pipe(
    NEGenF_.sequenceT(keys, subQueries),
    NEGenF_.map(([key, subQuery]) => Dict_.dict([key, subQuery])),
  );
}

export function resultExamples<K extends Key<any>, SR extends Result<any>>(
  keys: Examples<K>,
  subResults: Examples<SR>,
): Examples<KeysResult<Dict<K, SR>>> {
  return pipe(
    NEGenF_.sequenceT(keys, subResults),
    NEGenF_.map(
      ([key, subResult]): KeysResult<Dict<K, SR>> => Dict_.dict([key, subResult]),
    ),
  );
}

export const bundle = <
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>,
  C extends Context,
  QA extends Resolvers<any>,
  RA extends Reporters<any>,
  K extends Key<any>
>(
  key: { Key: KeyCodec<K>; keyExamples: NonEmptyArray<K> },
  item: Protocol<Q, R, E, Prepend<K, C>, QA, RA>,
): Protocol<KeysQuery<Dict<K, Q>>, KeysResult<Dict<K, R>>, E, C, QA, RA> =>
  protocol({
    Query: Dict(key.Key, item.Query),
    Result: Dict(key.Key, item.Result),
    Err: item.Err,
    processQuery: processQuery(item.processQuery),
    processResult: processResult(item.processResult),
    reduceResult: reduceResult(item.reduceResult),
    queryExamples: queryExamples(examples(key.keyExamples), item.queryExamples),
    resultExamples: resultExamples(examples(key.keyExamples), item.resultExamples),
  });
