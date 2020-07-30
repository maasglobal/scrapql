import * as Array_ from 'fp-ts/lib/Array';
import * as Either_ from 'fp-ts/lib/Either';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { Either } from 'fp-ts/lib/Either';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { pipe } from 'fp-ts/lib/pipeable';

import {
  Context,
  Err,
  Examples,
  LeafProtocolSeed,
  LeafQuery,
  LeafResult,
  LeafResultCombiner,
  Protocol,
  Query,
  QueryProcessor,
  PayloadMismatch,
  ReporterConnector,
  Reporters,
  ResolverConnector,
  Resolvers,
  Result,
  ResultProcessor,
  ResultReducer,
  examples,
  protocol,
} from '../scrapql';

// leaf query contains information for retrieving a payload

export function processQuery<
  Q extends LeafQuery<any>,
  E extends Err<any>,
  C extends Context,
  A extends Resolvers<any>,
  R extends LeafResult<any>
>(connect: ResolverConnector<Q, R, E, C, A>): QueryProcessor<Q, R, E, C, A> {
  return (query: Q) => (context: C): ReaderTaskEither<A, E, R> => {
    return (resolvers) => {
      const resolver = connect(resolvers);
      return resolver(query, context);
    };
  };
}

// leaf result contains part of the payload

export function processResult<
  R extends LeafResult<any>,
  C extends Context,
  A extends Reporters<any>
>(connect: ReporterConnector<R, C, A>): ResultProcessor<R, C, A> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters) => {
      const reporter = connect(reporters);
      return reporter(result, context);
    };
  };
}

export const reduceResult = <R extends LeafResult<any>>(
  combineLeafResult: LeafResultCombiner<R>,
): ResultReducer<R> => (results) => {
  const writeResult: R = NonEmptyArray_.head(results);
  const readResult: Array<R> = NonEmptyArray_.tail(results);
  const result: Either<PayloadMismatch, R> = pipe(
    readResult,
    Array_.reduce(Either_.right(writeResult), (ew, r) =>
      pipe(
        ew,
        Either_.chain((w) => combineLeafResult(w, r)),
      ),
    ),
  );
  return result;
};

export function queryExamples<Q extends LeafQuery<any>>(
  queries: NonEmptyArray<Q>,
): Examples<Q> {
  return examples(queries);
}

export function resultExamples<R extends LeafResult<any>>(
  results: NonEmptyArray<R>,
): Examples<R> {
  return examples(results);
}

export const bundle = <
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>,
  C extends Context,
  QA extends Resolvers<any>,
  RA extends Reporters<any>
>(
  seed: LeafProtocolSeed<Q, R, E, C, QA, RA>,
): Protocol<Q, R, E, C, QA, RA> =>
  protocol({
    Query: seed.Query,
    Result: seed.Result,
    Err: seed.Err,
    processQuery: processQuery(seed.queryConnector),
    processResult: processResult(seed.resultConnector),
    reduceResult: reduceResult(seed.resultCombiner),
    queryExamples: queryExamples(seed.queryExamplesArray),
    resultExamples: resultExamples(seed.resultExamplesArray),
  });
