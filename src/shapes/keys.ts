import * as Array_ from 'fp-ts/lib/Array';
import { array } from 'fp-ts/lib/Array';
import { Either } from 'fp-ts/lib/Either';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import { identity } from 'fp-ts/lib/function';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { pipe } from 'fp-ts/lib/pipeable';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import { Task, taskSeq } from 'fp-ts/lib/Task';
import { TaskEither } from 'fp-ts/lib/TaskEither';

import {
  Context,
  Err,
  Examples,
  examples,
  Key,
  KeysBundle,
  KeysBundleSeed,
  KeysQuery,
  KeysResult,
  protocol,
  Query,
  QueryProcessor,
  ReduceFailure,
  Reporters,
  Resolvers,
  Result,
  ResultProcessor,
  ResultReducer,
  Workspace,
} from '../scrapql';
import * as Dict_ from '../utils/dict';
import { Dict } from '../utils/dict';
import * as NonEmptyList_ from '../utils/non-empty-list';
import * as Tuple_ from '../utils/tuple';

// keys query requests some information that is always present in database

export function processQuery<
  Q extends KeysQuery<Dict<K, SQ>>,
  E extends Err<any>,
  C extends Context<Array<any>>,
  W extends Workspace<any>,
  A extends Resolvers<any>,
  K extends Key<any>,
  SQ extends Query<any>,
  SR extends Result<any>
>(
  subProcessor: QueryProcessor<SQ, SR, E, Tuple_.Prepend<K, C>, W, A>,
): QueryProcessor<Q, KeysResult<Dict<K, SR>>, E, C, W, A> {
  return (query: Q) => (
    context: C,
    workspace: W,
  ): ReaderTaskEither<A, E, KeysResult<Dict<K, SR>>> => {
    return (resolvers) =>
      pipe(
        query,
        Dict_.mapWithIndex(
          (key: K, subQuery: SQ): TaskEither<E, SR> => {
            const subContext = pipe(context, Tuple_.prepend(key));
            return subProcessor(subQuery)(subContext, workspace)(resolvers);
          },
        ),
        Dict_.sequenceTaskEither,
      );
  };
}

// keys result contains data that always exists in database

export function processResult<
  R extends KeysResult<Dict<K, SR>>,
  C extends Context<Array<any>>,
  A extends Reporters<any>,
  K extends Key<any>,
  SR extends Result<any>
>(subProcessor: ResultProcessor<SR, Tuple_.Prepend<K, C>, A>): ResultProcessor<R, C, A> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters): Task<void> => {
      const tasks: Array<Task<void>> = pipe(
        result,
        Dict_.mapWithIndex((key: K, subResult: SR) => {
          const subContext = pipe(context, Tuple_.prepend(key));
          return subProcessor(subResult)(subContext, {})(reporters);
        }),
        Array_.map(([_k, v]) => v),
      );
      return Foldable_.traverse_(taskSeq, array)(tasks, identity);
    };
  };
}

export const reduceResult = <K extends Key<string>, SR extends Result<any>>(
  reduceSubResult: ResultReducer<SR>,
): ResultReducer<KeysResult<Dict<K, SR>>> => (results) =>
  pipe(
    results,
    Dict_.mergeAsymmetric(
      (subResultVariants: NonEmptyArray<SR>): Either<ReduceFailure, SR> =>
        reduceSubResult(subResultVariants),
    ),
  );

export function queryExamples<K extends Key<any>, SQ extends Query<any>>(
  keys: Examples<K>,
  subQueries: Examples<SQ>,
): Examples<KeysQuery<Dict<K, SQ>>> {
  return pipe(
    NonEmptyList_.sequenceT(keys, subQueries),
    NonEmptyList_.map(([key, subQuery]) => Dict_.dict([key, subQuery])),
  );
}

export function resultExamples<K extends Key<any>, SR extends Result<any>>(
  keys: Examples<K>,
  subResults: Examples<SR>,
): Examples<KeysResult<Dict<K, SR>>> {
  return pipe(
    NonEmptyList_.sequenceT(keys, subResults),
    NonEmptyList_.map(
      ([key, subResult]): KeysResult<Dict<K, SR>> => Dict_.dict([key, subResult]),
    ),
  );
}

export const bundle = <
  E extends Err<any>,
  C extends Context<Array<any>>,
  W extends Workspace<any>,
  QA extends Resolvers<any>,
  RA extends Reporters<any>,
  K extends Key<string>,
  SQ extends Query<any>,
  SR extends Result<any>
>(
  seed: KeysBundleSeed<E, C, W, QA, RA, K, SQ, SR>,
): KeysBundle<E, C, W, QA, RA, K, SQ, SR> =>
  protocol({
    Query: Dict(seed.key.Key, seed.item.Query),
    Result: Dict(seed.key.Key, seed.item.Result),
    Err: seed.item.Err,
    processQuery: processQuery(seed.item.processQuery),
    processResult: processResult(seed.item.processResult),
    reduceResult: reduceResult(seed.item.reduceResult),
    queryExamples: queryExamples(examples(seed.key.keyExamples), seed.item.queryExamples),
    resultExamples: resultExamples(
      examples(seed.key.keyExamples),
      seed.item.resultExamples,
    ),
  });
