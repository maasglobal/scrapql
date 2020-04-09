import * as Array_ from 'fp-ts/lib/Array';
import * as Either_ from 'fp-ts/lib/Either';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { Either } from 'fp-ts/lib/Either';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { pipe } from 'fp-ts/lib/pipeable';

import {
  Context,
  Examples,
  LeafQuery,
  LeafResult,
  LeafResultCombiner,
  QueryProcessor,
  ReduceFailure,
  ReporterConnector,
  Reporters,
  ResolverConnector,
  Resolvers,
  ResultProcessor,
  examples,
} from '../scrapql';

// leaf query contains information for retrieving a payload

export function processQuery<
  A extends Resolvers,
  Q extends LeafQuery,
  R extends LeafResult,
  C extends Context
>(connect: ResolverConnector<A, Q, R, C>): QueryProcessor<Q, R, A, C> {
  return (query: Q) => (context: C): ReaderTask<A, R> => {
    return (resolvers) => {
      const resolver = connect(resolvers);
      return resolver(query, context);
    };
  };
}

// leaf result contains part of the payload

export function processResult<
  A extends Reporters,
  R extends LeafResult,
  C extends Context
>(connect: ReporterConnector<A, R, C>): ResultProcessor<R, A, C> {
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
  return pipe(readResult, Array_.reduce(writeResult, combineLeafResult), Either_.right);
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
