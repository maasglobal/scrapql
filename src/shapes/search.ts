import * as Array_ from 'fp-ts/lib/Array';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';
import { Either } from 'fp-ts/lib/Either';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
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

import {
  Context,
  Err,
  Examples,
  Id,
  IdCodec,
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
  SearchQuery,
  SearchResult,
  Terms,
  TermsCodec,
  TermsQuery,
  TermsResult,
  reduceeMismatch,
  examples,
  protocol,
  termsQuery,
  termsResult,
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
  connect: ResolverConnector<A, TermsQuery<T>, TermsResult<I>, E, C>,
  subProcessor: QueryProcessor<SQ, SR, E, A, Prepend<I, C>>,
): QueryProcessor<Q, SearchResult<SR, T, I>, E, A, C> {
  return (query: Q) => (context: C): ReaderTaskEither<A, E, SearchResult<SR, T, I>> => {
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
                    Array_.map((id: I): [I, TaskEither<E, SR>] => {
                      const subContext = pipe(context, Context_.prepend(id));
                      const subResult = subProcessor(subQuery)(subContext)(resolvers);
                      return [id, subResult];
                    }),
                    Dict_.sequenceTaskEither,
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

// search result contains data that may contain zero or more instances in the database

export function processResult<
  A extends Reporters,
  R extends SearchResult<SR, T, I>,
  T extends Terms,
  I extends Id,
  SR extends Result,
  C extends Context,
  E extends Err
>(
  connect: ReporterConnector<A, TermsResult<I>, Prepend<T, C>>,
  subProcessor: ResultProcessor<SR, A, Prepend<I, C>>,
): ResultProcessor<R, A, C> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters): Task<void> => {
      const tasks: Array<Task<void>> = pipe(
        result,
        Dict_.mapWithIndex(
          (terms: T, subResults: Dict<I, SR>): Array<Task<void>> => {
            const termsContext = pipe(context, Onion_.prepend(terms));
            const reportIds: Task<void> = pipe(
              Dict_.keys(subResults),
              (ids: Array<I>): Task<void> =>
                connect(reporters)(termsResult<I>(ids), termsContext),
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
) => (
  results: NonEmptyArray<SearchResult<SR, T, I>>,
): Either<ReduceFailure, SearchResult<SR, T, I>> =>
  pipe(
    results,
    Dict_.mergeSymmetric(
      () => reduceeMismatch,
      Dict_.mergeSymmetric(() => reduceeMismatch, reduceSubResult),
    ),
  );

export function queryExamples<T extends Terms, SQ extends Result>(
  searches: Examples<T>,
  subQueries: Examples<SQ>,
): Examples<SearchQuery<SQ, T>> {
  return pipe(
    NEGenF_.sequenceT(searches, subQueries),
    NEGenF_.map(([search, subQuery]) => Dict_.dict([search, subQuery])),
  );
}

export function resultExamples<
  T extends Terms,
  I extends Id,
  E extends Err,
  SR extends Result
>(
  termss: Examples<T>,
  ids: Examples<I>,
  subResults: Examples<SR>,
): Examples<SearchResult<SR, T, I>> {
  return pipe(
    NEGenF_.sequenceT(termss, ids, subResults),
    NEGenF_.map(
      ([terms, id, subResult]): SearchResult<SR, T, I> =>
        Dict_.dict([terms, Dict_.dict([id, subResult])]),
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
  T extends Terms,
  I extends Id
>(
  terms: { Terms: TermsCodec<T>; termsExamples: NonEmptyArray<T> },
  id: { Id: IdCodec<I>; idExamples: NonEmptyArray<I> },
  item: Protocol<Q, R, E, Prepend<I, C>, QA, RA>,
  queryConnector: ResolverConnector<QA, TermsQuery<T>, TermsResult<I>, E, C>,
  resultConnector: ReporterConnector<RA, TermsResult<I>, Prepend<T, C>>,
): Protocol<SearchQuery<Q, T>, SearchResult<R, T, I>, E, C, QA, RA> =>
  protocol({
    Query: Dict(terms.Terms, item.Query),
    Result: Dict(terms.Terms, Dict(id.Id, item.Result)),
    Err: item.Err,
    processQuery: processQuery(queryConnector, item.processQuery),
    processResult: processResult(resultConnector, item.processResult),
    reduceResult: reduceResult(item.reduceResult),
    queryExamples: queryExamples(examples(terms.termsExamples), item.queryExamples),
    resultExamples: resultExamples(
      examples(terms.termsExamples),
      examples(id.idExamples),
      item.resultExamples,
    ),
  });
