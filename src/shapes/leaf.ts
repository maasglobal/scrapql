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
  ReduceFailure,
  ReporterConnector,
  Reporters,
  ResolverConnector,
  Resolvers,
  Result,
  ResultProcessor,
  examples,
  protocol,
} from '../scrapql';

// leaf query contains information for retrieving a payload

export function processQuery<
  Q extends LeafQuery,
  E extends Err,
  C extends Context,
  A extends Resolvers,
  R extends LeafResult
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
  R extends LeafResult,
  C extends Context,
  A extends Reporters
>(connect: ReporterConnector<R, C, A>): ResultProcessor<R, C, A> {
  return (result: R) => (context: C): ReaderTask<A, void> => {
    return (reporters) => {
      const reporter = connect(reporters);
      return reporter(result, context);
    };
  };
}

export const reduceResult = <R extends LeafResult>(
  combineLeafResult: LeafResultCombiner<R>,
) => (results: NonEmptyArray<R>): Either<ReduceFailure, R> => {
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

export function queryExamples<Q extends LeafQuery>(
  queries: NonEmptyArray<Q>,
): Examples<Q> {
  return examples(queries);
}

export function resultExamples<R extends LeafResult>(
  results: NonEmptyArray<R>,
): Examples<R> {
  return examples(results);
}

export const bundle = <
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context,
  QA extends Resolvers,
  RA extends Reporters
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
