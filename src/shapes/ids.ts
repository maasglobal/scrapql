import * as Array_ from 'fp-ts/lib/Array';
import * as Either_ from 'fp-ts/lib/Either';
import { Either } from 'fp-ts/lib/Either';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import { flow } from 'fp-ts/lib/function';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/function';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import { Task } from 'fp-ts/lib/Task';
import * as Task_ from 'fp-ts/lib/Task';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { option as tOption } from 'io-ts-types/lib/option';

import {
  Context,
  Err,
  Examples,
  examples,
  Existence,
  ExistenceReporterConnector,
  ExistenceResolverConnector,
  Id,
  IdsBundle,
  IdsBundleSeed,
  IdsQuery,
  IdsResult,
  protocol,
  Query,
  QueryProcessor,
  ReduceFailure,
  Reporters,
  Resolvers,
  Result,
  ResultProcessor,
  ResultReducer,
  structuralMismatch,
  Workspace,
} from '../scrapql';
import * as Dict_ from '../utils/dict';
import { Dict } from '../utils/dict';
import * as NonEmptyList_ from '../utils/non-empty-list';
import * as Object_ from '../utils/object';
import { mergeOption } from '../utils/option';
import * as Tuple_ from '../utils/tuple';

// ids query requests some information that may not be present in database

export function processQuery<
  Q extends IdsQuery<Dict<I, SQ>>,
  E extends Err<any>,
  C extends Context<Array<any>>,
  W extends Workspace<Object_.Object>,
  A extends Resolvers<any>,
  I extends Id<any>,
  WX extends Workspace<Object_.Object>,
  SQ extends Query<any>,
  SR extends Result<any>
>(
  connect: ExistenceResolverConnector<I, Option<WX>, E, C, W, A>,
  subProcessor: QueryProcessor<SQ, SR, E, Tuple_.Prepend<I, C>, Object_.Merge<W, WX>, A>,
): QueryProcessor<Q, IdsResult<Dict<I, Option<SR>>>, E, C, W, A> {
  return (query: Q) => (
    context: C,
    workspace: W,
  ): ReaderTaskEither<A, E, IdsResult<Dict<I, Option<SR>>>> => {
    return (resolvers) => {
      const tasks: Dict<I, TaskEither<E, Option<SR>>> = pipe(
        query,
        Dict_.mapWithIndex(
          (id: I, subQuery: SQ): TaskEither<E, Option<SR>> => {
            const subContext = pipe(context, Tuple_.prepend(id));
            const existenceCheck = connect(resolvers);
            return pipe(
              existenceCheck(id, context, workspace),
              TaskEither_.chain(
                (exists: Option<WX>): TaskEither<E, Option<SR>> =>
                  pipe(
                    exists,
                    Option_.fold(
                      () => TaskEither_.right(Option_.none),
                      (x) => {
                        const subWorkspace = Object_.merge(workspace, x);
                        return pipe(
                          subProcessor(subQuery)(subContext, subWorkspace)(resolvers),
                          TaskEither_.map(Option_.some),
                        );
                      },
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
  C extends Context<Array<any>>,
  A extends Reporters<any>,
  I extends Id<any>,
  SR extends Result<any>
>(
  connect: ExistenceReporterConnector<I, Existence, C, A>,
  subProcessor: ResultProcessor<SR, Tuple_.Prepend<I, C>, A>,
): ResultProcessor<R, C, A> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters) => {
      const tasks: Array<Task<void>> = pipe(
        result,
        Dict_.mapWithIndex((id: I, maybeSubResult: Option<SR>) => {
          const subContext = pipe(context, Tuple_.prepend(id));
          return pipe(
            maybeSubResult,
            Option_.fold(
              () => [connect(reporters)(false, subContext, {})],
              (subResult) => [
                connect(reporters)(true, subContext, {}),
                subProcessor(subResult)(subContext, {})(reporters),
              ],
            ),
          );
        }),
        Array_.map(([_k, v]) => v),
        Array_.flatten,
      );
      return Foldable_.traverse_(Task_.ApplicativeSeq, Array_.Foldable)(tasks, identity);
    };
  };
}

export const reduceResult = <I extends Id<string>, SR extends Result<any>>(
  reduceSubResult: ResultReducer<SR>,
): ResultReducer<IdsResult<Dict<I, Option<SR>>>> => (results) =>
  pipe(
    results,
    Dict_.mergeAsymmetric(
      (subResultVariants: NonEmptyArray<Option<SR>>): Either<ReduceFailure, Option<SR>> =>
        pipe(
          mergeOption(subResultVariants),
          Either_.fromOption(() => structuralMismatch('option')),
          Either_.chain(
            flow(
              NonEmptyArray_.sequence(Option_.Applicative),
              Option_.map((subResultVariants) => reduceSubResult(subResultVariants)),
              Option_.sequence(Either_.Applicative),
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
  E extends Err<any>,
  C extends Context<Array<any>>,
  W extends Workspace<Object_.Object>,
  QA extends Resolvers<any>,
  RA extends Reporters<any>,
  I extends Id<string>,
  WX extends Workspace<Object_.Object>,
  SQ extends Query<any>,
  SR extends Result<any>
>(
  seed: IdsBundleSeed<E, C, W, QA, RA, I, WX, SQ, SR>,
): IdsBundle<E, C, W, QA, RA, I, SQ, SR> =>
  protocol({
    Query: Dict(seed.id.Id, seed.item.Query),
    Result: Dict(seed.id.Id, tOption(seed.item.Result)),
    Err: seed.item.Err,
    processQuery: processQuery(seed.queryConnector, seed.item.processQuery),
    processResult: processResult(seed.resultConnector, seed.item.processResult),
    reduceResult: reduceResult(seed.item.reduceResult),
    queryExamples: queryExamples(examples(seed.id.idExamples), seed.item.queryExamples),
    resultExamples: resultExamples(
      examples(seed.id.idExamples),
      seed.item.resultExamples,
    ),
  });
