import * as Array_ from 'fp-ts/lib/Array';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';
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

import {
  Context,
  Err,
  Examples,
  Id,
  Query,
  QueryProcessor,
  Reporters,
  Resolvers,
  Result,
  ResultProcessor,
  ResultReducer,
  SearchBundle,
  SearchBundleSeed,
  SearchQuery,
  SearchResult,
  Terms,
  TermsReporterConnector,
  TermsResolverConnector,
  structuralMismatch,
  examples,
  protocol,
} from '../scrapql';

// search query requests some information that may zero or more instances in the database

export function processQuery<
  Q extends SearchQuery<Dict<T, SQ>>,
  E extends Err<any>,
  C extends Context,
  A extends Resolvers<any>,
  T extends Terms<any>,
  I extends Id<any>,
  SQ extends Query<any>,
  SR extends Result<any>
>(
  connect: TermsResolverConnector<T, Array<I>, E, C, A>,
  subProcessor: QueryProcessor<SQ, SR, E, Prepend<I, C>, A>,
): QueryProcessor<Q, SearchResult<Dict<T, Dict<I, SR>>>, E, C, A> {
  return (query: Q) => (
    context: C,
  ): ReaderTaskEither<A, E, SearchResult<Dict<T, Dict<I, SR>>>> => {
    return (resolvers) => {
      const tasks: Dict<T, TaskEither<E, Dict<I, SR>>> = pipe(
        query,
        Dict_.mapWithIndex(
          (terms: T, subQuery: SQ): TaskEither<E, Dict<I, SR>> => {
            const idResolver = connect(resolvers);
            return pipe(
              idResolver(terms, context),
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
  R extends SearchResult<Dict<T, Dict<I, SR>>>,
  C extends Context,
  A extends Reporters<any>,
  T extends Terms<any>,
  I extends Id<any>,
  SR extends Result<any>
>(
  connect: TermsReporterConnector<T, Array<I>, C, A>,
  subProcessor: ResultProcessor<SR, Prepend<I, C>, A>,
): ResultProcessor<R, C, A> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters): Task<void> => {
      const tasks: Array<Task<void>> = pipe(
        result,
        Dict_.mapWithIndex(
          (terms: T, subResults: Dict<I, SR>): Array<Task<void>> => {
            const termsContext = pipe(context, Onion_.prepend(terms));
            const reportIds: Task<void> = pipe(
              Dict_.keys(subResults),
              (ids: Array<I>): Task<void> => connect(reporters)(ids, termsContext),
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
  T extends Terms<any>,
  I extends Id<any>,
  SR extends Result<any>
>(
  reduceSubResult: ResultReducer<SR>,
): ResultReducer<SearchResult<Dict<T, Dict<I, SR>>>> => (results) =>
  pipe(
    results,
    Dict_.mergeSymmetric(
      () => structuralMismatch('terms'),
      Dict_.mergeSymmetric(() => structuralMismatch('ids'), reduceSubResult),
    ),
  );

export function queryExamples<T extends Terms<any>, SQ extends Result<any>>(
  searches: Examples<T>,
  subQueries: Examples<SQ>,
): Examples<SearchQuery<Dict<T, SQ>>> {
  return pipe(
    NonEmptyList_.sequenceT(searches, subQueries),
    NonEmptyList_.map(([search, subQuery]) => Dict_.dict([search, subQuery])),
  );
}

export function resultExamples<
  T extends Terms<any>,
  I extends Id<any>,
  SR extends Result<any>
>(
  termss: Examples<T>,
  ids: Examples<I>,
  subResults: Examples<SR>,
): Examples<SearchResult<Dict<T, Dict<I, SR>>>> {
  return pipe(
    NonEmptyList_.sequenceT(termss, ids, subResults),
    NonEmptyList_.map(
      ([terms, id, subResult]): SearchResult<Dict<T, Dict<I, SR>>> =>
        Dict_.dict([terms, Dict_.dict([id, subResult])]),
    ),
  );
}

export const bundle = <
  E extends Err<any>,
  C extends Context,
  QA extends Resolvers<any>,
  RA extends Reporters<any>,
  T extends Terms<any>,
  I extends Id<any>,
  SQ extends Query<any>,
  SR extends Result<any>
>(
  seed: SearchBundleSeed<E, C, QA, RA, T, I, SQ, SR>,
): SearchBundle<E, C, QA, RA, T, I, SQ, SR> =>
  protocol({
    Query: Dict(seed.terms.Terms, seed.item.Query),
    Result: Dict(seed.terms.Terms, Dict(seed.id.Id, seed.item.Result)),
    Err: seed.item.Err,
    processQuery: processQuery(seed.queryConnector, seed.item.processQuery),
    processResult: processResult(seed.resultConnector, seed.item.processResult),
    reduceResult: reduceResult(seed.item.reduceResult),
    queryExamples: queryExamples(
      examples(seed.terms.termsExamples),
      seed.item.queryExamples,
    ),
    resultExamples: resultExamples(
      examples(seed.terms.termsExamples),
      examples(seed.id.idExamples),
      seed.item.resultExamples,
    ),
  });
