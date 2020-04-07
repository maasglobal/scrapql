import * as Array_ from 'fp-ts/lib/Array';
import * as Either_ from 'fp-ts/lib/Either';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import * as Option_ from 'fp-ts/lib/Option';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';
import { Either, either } from 'fp-ts/lib/Either';
import { flow } from 'fp-ts/lib/function';
import { NonEmptyArray, nonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { Task, taskSeq } from 'fp-ts/lib/Task';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { array } from 'fp-ts/lib/Array';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';

import * as Context_ from '../onion';
import * as Dict_ from '../dict';
import * as Onion_ from '../onion';
import { Dict } from '../dict';
import { Prepend } from '../onion';

import {
  Context,
  Err,
  Id,
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
  SearchQuery,
  SearchResult,
  Terms,
  TermsQuery,
  TermsResult,
  reduceeMismatch,
  termsQuery,
} from '../scrapql';

// search query requests some information that may zero or more instances in the database

export function processQuery<
  A extends Resolvers,
  Q extends SearchQuery<SQ, T>,
  T extends Terms,
  I extends Id,
  SQ extends Query,
  SR extends Result,
  C extends Context,
  E extends Err
>(
  connect: ResolverConnector<A, TermsQuery<T>, TermsResult<I, E>, C>,
  subProcessor: QueryProcessor<SQ, SR, A, Prepend<I, C>>,
): QueryProcessor<Q, SearchResult<SR, T, I, E>, A, C> {
  return (query: Q) => (context: C): ReaderTask<A, SearchResult<SR, T, I, E>> => {
    return (resolvers) => {
      const tasks: Dict<T, TaskEither<E, Dict<I, SR>>> = pipe(
        query,
        Dict_.mapWithIndex(
          (terms: T, subQuery: SQ): TaskEither<E, Dict<I, SR>> => {
            const idResolver = connect(resolvers);
            return pipe(
              idResolver(termsQuery(terms), context),
              TaskEither_.chain(
                (ids: Array<I>): TaskEither<E, Dict<I, SR>> =>
                  pipe(
                    ids,
                    Array_.map((id: I): [I, Task<SR>] => {
                      const subContext = pipe(context, Context_.prepend(id));
                      const subResult = subProcessor(subQuery)(subContext)(resolvers);
                      return [id, subResult];
                    }),
                    Dict_.sequenceTask,
                    TaskEither_.rightTask,
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

// search result contains data that may contain zero or more instances in the database

export function processResult<
  A extends Reporters,
  R extends SearchResult<SR, T, I, E>,
  T extends Terms,
  I extends Id,
  SR extends Result,
  C extends Context,
  E extends Err
>(
  connect: ReporterConnector<A, TermsResult<I, E>, Prepend<T, C>>,
  subProcessor: ResultProcessor<SR, A, Prepend<I, C>>,
): ResultProcessor<R, A, C> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters) => {
      const tasks: Array<Task<void>> = pipe(
        result,
        Dict_.mapWithIndex(
          (terms: T, maybeSubResult: Either<E, Dict<I, SR>>): Array<Task<void>> => {
            const termsContext = pipe(context, Onion_.prepend(terms));
            return pipe(
              maybeSubResult,
              Either_.fold(
                (err) => [
                  connect(reporters)(Either_.left<E, Array<I>>(err), termsContext),
                ],
                (subResults: Dict<I, SR>): Array<Task<void>> => {
                  const reportIds: Task<void> = pipe(
                    Dict_.keys(subResults),
                    (ids: Array<I>): Task<void> =>
                      connect(reporters)(Either_.right<E, Array<I>>(ids), termsContext),
                  );
                  const reportResults: Array<Task<void>> = pipe(
                    subResults,
                    Array_.map(([id, subResult]: [I, SR]) => {
                      const idContext = pipe(context, Onion_.prepend(id));
                      return subProcessor(subResult)(idContext)(reporters);
                    }),
                  );
                  return pipe([[reportIds], reportResults], Array_.flatten);
                },
              ),
            );
          },
        ),
        (x: Dict<T, Array<Task<void>>>) => x,
        Array_.map(([_k, v]) => v),
        Array_.flatten,
      );
      return Foldable_.traverse_(taskSeq, array)(tasks, identity);
    };
  };
}

export const reduceResult = <
  T extends Terms,
  I extends Id,
  E extends Err,
  SR extends Result
>(
  reduceSubResult: ResultReducer<SR>,
  matchChange: (e: NonEmptyArray<Array<I>>) => E,
) => (
  results: NonEmptyArray<SearchResult<SR, T, I, E>>,
): Either<ReduceFailure, SearchResult<SR, T, I, E>> =>
  pipe(
    results,
    Dict_.mergeSymmetric((subResultVariants: NonEmptyArray<Either<E, Dict<I, SR>>>) =>
      pipe(
        subResultVariants,
        nonEmptyArray.sequence(either),
        Either_.chain((subResultDicts) =>
          pipe(
            subResultDicts,
            Dict_.mergeSymmetric(flow(reduceSubResult, Option_.some)),
            Either_.fromOption(
              (): E => pipe(subResultDicts, NonEmptyArray_.map(Dict_.keys), matchChange),
            ),
            Either_.map(Dict_.sequenceEither),
          ),
        ),
        either.sequence(either),
        Option_.some,
      ),
    ),
    Either_.fromOption(() => reduceeMismatch),
    Either_.chain(Dict_.sequenceEither),
  );
