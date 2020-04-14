import * as Array_ from 'fp-ts/lib/Array';
import * as Either_ from 'fp-ts/lib/Either';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as Option_ from 'fp-ts/lib/Option';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';
import * as Task_ from 'fp-ts/lib/Task';
import * as boolean_ from 'fp-ts/lib/boolean';
import { Either, either } from 'fp-ts/lib/Either';
import { either as tEither } from 'io-ts-types/lib/either';
import { Lazy, flow } from 'fp-ts/lib/function';
import { NonEmptyArray, nonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { Option, option } from 'fp-ts/lib/Option';
import { option as tOption } from 'io-ts-types/lib/option';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { Task, taskSeq } from 'fp-ts/lib/Task';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { array } from 'fp-ts/lib/Array';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';

import * as Context_ from '../onion';
import * as Dict_ from '../dict';
import * as NEGenF_ from '../negf';
import * as Onion_ from '../onion';
import { Dict } from '../dict';
import { Prepend } from '../onion';
import { mergeOption } from '../option';

import {
  Context,
  Err,
  Examples,
  Existence,
  ExistenceQuery,
  ExistenceResult,
  Id,
  IdCodec,
  IdsQuery,
  IdsResult,
  Protocol,
  Query,
  QueryProcessor,
  ReduceFailure,
  ReporterConnector,
  Reporters,
  ResolverConnector,
  Resolvers,
  Result,
  ResultProcessor,
  ResultReducer,
  examples,
  existenceQuery,
  protocol,
  reduceeMismatch,
} from '../scrapql';

// ids query requests some information that may not be present in database

export function processQuery<
  A extends Resolvers,
  Q extends IdsQuery<SQ, I>,
  I extends Id,
  SQ extends Query,
  SR extends Result,
  C extends Context,
  E extends Err
>(
  connect: ResolverConnector<A, ExistenceQuery<I>, ExistenceResult<E>, C>,
  subProcessor: QueryProcessor<SQ, SR, A, Prepend<I, C>>,
): QueryProcessor<Q, IdsResult<SR, I, E>, A, C> {
  return (query: Q) => (context: C): ReaderTask<A, IdsResult<SR, I, E>> => {
    return (resolvers) => {
      const tasks: Dict<I, TaskEither<E, Option<SR>>> = pipe(
        query,
        Dict_.mapWithIndex(
          (id: I, subQuery: SQ): TaskEither<E, Option<SR>> => {
            const subContext = pipe(context, Context_.prepend(id));
            const existenceCheck = connect(resolvers);
            return pipe(
              existenceCheck(existenceQuery(id), context),
              TaskEither_.chain((exists: Existence) =>
                pipe(
                  exists,
                  boolean_.fold(
                    (): TaskEither<E, Option<SR>> => TaskEither_.right(Option_.none),
                    (): TaskEither<E, Option<SR>> =>
                      pipe(
                        subProcessor(subQuery)(subContext)(resolvers),
                        Task_.map(Option_.some),
                        TaskEither_.rightTask,
                      ),
                  ),
                ),
              ),
            );
          },
        ),
      );
      return Dict_.sequenceTask(tasks);
    };
  };
}

// ids result contains data that may not exist in database

export function processResult<
  A extends Reporters,
  R extends IdsResult<SR, I, E>,
  I extends Id,
  SR extends Result,
  C extends Context,
  E extends Err
>(
  connect: ReporterConnector<A, ExistenceResult<E>, Prepend<I, C>>,
  subProcessor: ResultProcessor<SR, A, Prepend<I, C>>,
): ResultProcessor<R, A, C> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters) => {
      const tasks: Array<Task<void>> = pipe(
        result,
        Dict_.mapWithIndex((id: I, maybeSubResult: Either<E, Option<SR>>) => {
          const subContext = pipe(context, Onion_.prepend(id));
          return pipe(
            maybeSubResult,
            Either_.fold(
              (err) => [connect(reporters)(Either_.left<E, Existence>(err), subContext)],
              (opt) =>
                pipe(
                  opt,
                  Option_.fold(
                    () => [
                      connect(reporters)(Either_.right<E, Existence>(false), subContext),
                    ],
                    (subResult) => [
                      connect(reporters)(Either_.right<E, Existence>(true), subContext),
                      subProcessor(subResult)(subContext)(reporters),
                    ],
                  ),
                ),
            ),
          );
        }),
        Array_.map(([_k, v]) => v),
        Array_.flatten,
      );
      return Foldable_.traverse_(taskSeq, array)(tasks, identity);
    };
  };
}

export const reduceResult = <I extends Id, E extends Err, SR extends Result>(
  reduceSubResult: ResultReducer<SR>,
  existenceChange: Lazy<E>,
) => (
  results: NonEmptyArray<IdsResult<SR, I, E>>,
): Either<ReduceFailure, IdsResult<SR, I, E>> =>
  pipe(
    results,
    Dict_.mergeSymmetric(
      (
        subResultVariants: NonEmptyArray<Either<E, Option<SR>>>,
      ): Option<Either<ReduceFailure, Either<E, Option<SR>>>> =>
        pipe(
          subResultVariants,
          nonEmptyArray.sequence(either),
          Either_.map(mergeOption),
          Either_.chain(Either_.fromOption(existenceChange)),
          Either_.map(
            flow(
              nonEmptyArray.sequence(option),
              Option_.map((subResultVariants) => reduceSubResult(subResultVariants)),
              option.sequence(either),
            ),
          ),
          either.sequence(either),
          Option_.some,
        ),
    ),
    Either_.fromOption(() => reduceeMismatch),
    Either_.chain(Dict_.sequenceEither),
  );

export function queryExamples<I extends Id, SQ extends Query>(
  ids: Examples<I>,
  subQueries: Examples<SQ>,
): Examples<IdsQuery<SQ, I>> {
  return pipe(
    NEGenF_.sequenceT(ids, subQueries),
    NEGenF_.map(([id, subQuery]) => Dict_.dict([id, subQuery])),
  );
}

export function resultExamples<I extends Id, SR extends Result, E extends Err>(
  ids: Examples<I>,
  subResults: Examples<SR>,
): Examples<IdsResult<SR, I, E>> {
  return pipe(
    NEGenF_.sequenceT(ids, subResults),
    NEGenF_.map(
      ([id, subResult]): IdsResult<SR, I, E> =>
        Dict_.dict([id, Either_.right(Option_.some(subResult))]),
    ),
  );
}

export const bundle = <
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context,
  QA extends Resolvers,
  RA extends Reporters,
  I extends Id
>(
  id: { Id: IdCodec<I>; idExamples: NonEmptyArray<I> },
  item: Protocol<Q, R, E, Prepend<I, C>, QA, RA>,
  queryConnector: ResolverConnector<QA, ExistenceQuery<I>, ExistenceResult<E>, C>,
  resultConnector: ReporterConnector<RA, ExistenceResult<E>, Prepend<I, C>>,
  existenceChange: Lazy<E>,
): Protocol<IdsQuery<Q, I>, IdsResult<R, I, E>, E, C, QA, RA> =>
  protocol({
    Query: Dict(id.Id, item.Query),
    Result: Dict(id.Id, tEither(item.Err, tOption(item.Result))),
    Err: item.Err,
    processQuery: processQuery(queryConnector, item.processQuery),
    processResult: processResult(resultConnector, item.processResult),
    reduceResult: reduceResult(item.reduceResult, existenceChange),
    queryExamples: queryExamples(examples(id.idExamples), item.queryExamples),
    resultExamples: resultExamples(examples(id.idExamples), item.resultExamples),
  });
