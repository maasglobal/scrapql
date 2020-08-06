import * as Array_ from 'fp-ts/lib/Array';
import * as Either_ from 'fp-ts/lib/Either';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as Option_ from 'fp-ts/lib/Option';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';
import * as boolean_ from 'fp-ts/lib/boolean';
import { Either, either } from 'fp-ts/lib/Either';
import { flow } from 'fp-ts/lib/function';
import { NonEmptyArray, nonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { Option, option } from 'fp-ts/lib/Option';
import { option as tOption } from 'io-ts-types/lib/option';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import { Task, taskSeq } from 'fp-ts/lib/Task';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { array } from 'fp-ts/lib/Array';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';

import * as Context_ from '../utils/onion';
import * as Dict_ from '../utils/dict';
import * as NonEmptyList_ from '../utils/non-empty-list';
import * as Onion_ from '../utils/onion';
import { Dict } from '../utils/dict';
import { Prepend } from '../utils/onion';
import { mergeOption } from '../utils/option';

import {
  Context,
  Err,
  Examples,
  Existence,
  ExistenceQuery,
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
  structuralMismatch,
} from '../scrapql';

// ids query requests some information that may not be present in database

export function processQuery<
  Q extends IdsQuery<Dict<I, SQ>>,
  E extends Err<any>,
  C extends Context,
  A extends Resolvers<any>,
  I extends Id<any>,
  SQ extends Query<any>,
  SR extends Result<any>
>(
  connect: ResolverConnector<ExistenceQuery<I>, Existence, E, C, A>,
  subProcessor: QueryProcessor<SQ, SR, E, Prepend<I, C>, A>,
): QueryProcessor<Q, IdsResult<Dict<I, Option<SR>>>, E, C, A> {
  return (query: Q) => (
    context: C,
  ): ReaderTaskEither<A, E, IdsResult<Dict<I, Option<SR>>>> => {
    return (resolvers) => {
      const tasks: Dict<I, TaskEither<E, Option<SR>>> = pipe(
        query,
        Dict_.mapWithIndex(
          (id: I, subQuery: SQ): TaskEither<E, Option<SR>> => {
            const subContext = pipe(context, Context_.prepend(id));
            const existenceCheck = connect(resolvers);
            return pipe(
              existenceCheck(existenceQuery(id), context),
              TaskEither_.chain(
                (exists: Existence): TaskEither<E, Option<SR>> =>
                  pipe(
                    exists,
                    boolean_.fold(
                      () => TaskEither_.right(Option_.none),
                      () =>
                        pipe(
                          subProcessor(subQuery)(subContext)(resolvers),
                          TaskEither_.map(Option_.some),
                        ),
                    ),
                  ),
              ),
            );
          },
        ),
      );
      return Dict_.sequenceTaskEither(tasks);
    };
  };
}

// ids result contains data that may not exist in database

export function processResult<
  R extends IdsResult<Dict<I, Option<SR>>>,
  C extends Context,
  A extends Reporters<any>,
  I extends Id<any>,
  SR extends Result<any>
>(
  connect: ReporterConnector<Existence, Prepend<I, C>, A>,
  subProcessor: ResultProcessor<SR, Prepend<I, C>, A>,
): ResultProcessor<R, C, A> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters) => {
      const tasks: Array<Task<void>> = pipe(
        result,
        Dict_.mapWithIndex((id: I, maybeSubResult: Option<SR>) => {
          const subContext = pipe(context, Onion_.prepend(id));
          return pipe(
            maybeSubResult,
            Option_.fold(
              () => [connect(reporters)(false, subContext)],
              (subResult) => [
                connect(reporters)(true, subContext),
                subProcessor(subResult)(subContext)(reporters),
              ],
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

export const reduceResult = <I extends Id<any>, SR extends Result<any>>(
  reduceSubResult: ResultReducer<SR>,
): ResultReducer<IdsResult<Dict<I, Option<SR>>>> => (results) =>
  pipe(
    results,
    Dict_.mergeSymmetric(
      () => structuralMismatch('id'),
      (subResultVariants: NonEmptyArray<Option<SR>>): Either<ReduceFailure, Option<SR>> =>
        pipe(
          mergeOption(subResultVariants),
          Either_.fromOption(() => structuralMismatch('option')),
          Either_.chain(
            flow(
              nonEmptyArray.sequence(option),
              Option_.map((subResultVariants) => reduceSubResult(subResultVariants)),
              option.sequence(either),
            ),
          ),
        ),
    ),
  );

export function queryExamples<I extends Id<any>, SQ extends Query<any>>(
  ids: Examples<I>,
  subQueries: Examples<SQ>,
): Examples<IdsQuery<Dict<I, SQ>>> {
  return pipe(
    NonEmptyList_.sequenceT(ids, subQueries),
    NonEmptyList_.map(([id, subQuery]) => Dict_.dict([id, subQuery])),
  );
}

export function resultExamples<I extends Id<any>, SR extends Result<any>>(
  ids: Examples<I>,
  subResults: Examples<SR>,
): Examples<IdsResult<Dict<I, Option<SR>>>> {
  return pipe(
    NonEmptyList_.sequenceT(ids, subResults),
    NonEmptyList_.map(
      ([id, subResult]): IdsResult<Dict<I, Option<SR>>> =>
        Dict_.dict([id, Option_.some(subResult)]),
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
  I extends Id<any>
>(
  id: { Id: IdCodec<I>; idExamples: NonEmptyArray<I> },
  item: Protocol<Q, R, E, Prepend<I, C>, QA, RA>,
  queryConnector: ResolverConnector<ExistenceQuery<I>, Existence, E, C, QA>,
  resultConnector: ReporterConnector<Existence, Prepend<I, C>, RA>,
): Protocol<IdsQuery<Dict<I, Q>>, IdsResult<Dict<I, Option<R>>>, E, C, QA, RA> =>
  protocol({
    Query: Dict(id.Id, item.Query),
    Result: Dict(id.Id, tOption(item.Result)),
    Err: item.Err,
    processQuery: processQuery(queryConnector, item.processQuery),
    processResult: processResult(resultConnector, item.processResult),
    reduceResult: reduceResult(item.reduceResult),
    queryExamples: queryExamples(examples(id.idExamples), item.queryExamples),
    resultExamples: resultExamples(examples(id.idExamples), item.resultExamples),
  });
