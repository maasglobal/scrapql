import * as Array_ from 'fp-ts/lib/Array';
import * as Either_ from 'fp-ts/lib/Either';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import * as Task_ from 'fp-ts/lib/Task';
import { Either } from 'fp-ts/lib/Either';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { pipe } from 'fp-ts/lib/pipeable';

import {
  Context,
  LiteralQuery,
  LiteralResult,
  QueryProcessor,
  ReduceFailure,
  Reporters,
  Resolvers,
  ResultProcessor,
  reduceeMismatch,
} from '../scrapql';

// literal query contains static information that can be replaced with another literal

export function processQuery<
  A extends Resolvers,
  Q extends LiteralQuery,
  R extends LiteralResult,
  C extends Context
>(constant: R): QueryProcessor<Q, R, A, C> {
  return (_query: Q) => (_context: C): ReaderTask<A, R> => {
    return (_resolvers) => Task_.of(constant);
  };
}

// literal result is known on forehand so we throw it away

export function processResult<
  A extends Reporters,
  R extends LiteralResult,
  C extends Context
>(): ResultProcessor<R, A, C> {
  return (_result: R) => (_context: C): ReaderTask<A, void> => {
    return (_reporters) => Task_.of(undefined);
  };
}

export const reduceResult = <L extends LiteralResult>(
  results: NonEmptyArray<L>,
): Either<ReduceFailure, L> =>
  pipe(
    NonEmptyArray_.tail(results),
    Array_.reduce(
      Either_.right(NonEmptyArray_.head(results)),
      (ma: Either<ReduceFailure, L>, b: L): Either<ReduceFailure, L> =>
        pipe(
          ma,
          Either_.chain((a) => {
            if (JSON.stringify(a) !== JSON.stringify(b)) {
              return Either_.left(reduceeMismatch);
            }
            return Either_.right(a);
          }),
        ),
    ),
  );
