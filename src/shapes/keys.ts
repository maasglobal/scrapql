import * as Array_ from 'fp-ts/lib/Array';
import * as Either_ from 'fp-ts/lib/Either';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as Option_ from 'fp-ts/lib/Option';
import { Either } from 'fp-ts/lib/Either';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { Option } from 'fp-ts/lib/Option';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { Task, taskSeq } from 'fp-ts/lib/Task';
import { array } from 'fp-ts/lib/Array';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';

import * as Context_ from '../onion';
import * as Dict_ from '../dict';
import * as NEGenF_ from '../negf';
import * as Onion_ from '../onion';
import { Dict } from '../dict';
import { Prepend } from '../onion';

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
  reduceeMismatch,
} from '../scrapql';

// keys query requests some information that is always present in database

export function processQuery<
  A extends Resolvers,
  Q extends KeysQuery<SQ, K>,
  K extends Key,
  SQ extends Query,
  SR extends Result,
  C extends Context
>(
  subProcessor: QueryProcessor<SQ, SR, A, Prepend<K, C>>,
): QueryProcessor<Q, KeysResult<SR, K>, A, C> {
  return (query: Q) => (context: C): ReaderTask<A, KeysResult<SR, K>> => {
    return (resolvers) =>
      pipe(
        query,
        Dict_.mapWithIndex(
          (key: K, subQuery: SQ): Task<SR> => {
            const subContext = pipe(context, Context_.prepend(key));
            return subProcessor(subQuery)(subContext)(resolvers);
          },
        ),
        Dict_.sequenceTask,
      );
  };
}

// keys result contains data that always exists in database

export function processResult<
  A extends Reporters,
  R extends KeysResult<SR, K>,
  K extends Key,
  SR extends Result,
  C extends Context
>(subProcessor: ResultProcessor<SR, A, Prepend<K, C>>): ResultProcessor<R, A, C> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters) => {
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

export const reduceResult = <K extends Key, SR extends Result>(
  reduceSubResult: ResultReducer<SR>,
) => (
  results: NonEmptyArray<KeysResult<SR, K>>,
): Either<ReduceFailure, KeysResult<SR, K>> =>
  pipe(
    results,
    Dict_.mergeSymmetric(
      (subResultVariants: NonEmptyArray<SR>): Option<Either<ReduceFailure, SR>> =>
        pipe(reduceSubResult(subResultVariants), Option_.some),
    ),
    Either_.fromOption(() => reduceeMismatch),
    Either_.chain(Dict_.sequenceEither),
  );

export function queryExamples<K extends Key, SQ extends Query>(
  keys: Examples<K>,
  subQueries: Examples<SQ>,
): Examples<KeysQuery<SQ, K>> {
  return pipe(
    NEGenF_.sequenceT(keys, subQueries),
    NEGenF_.map(([key, subQuery]) => Dict_.dict([key, subQuery])),
  );
}

export function resultExamples<K extends Key, SR extends Result>(
  keys: Examples<K>,
  subResults: Examples<SR>,
): Examples<KeysResult<SR, K>> {
  return pipe(
    NEGenF_.sequenceT(keys, subResults),
    NEGenF_.map(([key, subResult]): KeysResult<SR, K> => Dict_.dict([key, subResult])),
  );
}

export const bundle = <
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context,
  QA extends Resolvers,
  RA extends Reporters,
  K extends Key
>(
  key: { Key: KeyCodec<K>; keyExamples: NonEmptyArray<K> },
  item: Protocol<Q, R, E, Prepend<K, C>, QA, RA>,
): Protocol<KeysQuery<Q, K>, KeysResult<R, K>, E, C, QA, RA> =>
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
