import * as t from 'io-ts';
import * as Array_ from 'fp-ts/lib/Array';
import * as Either_ from 'fp-ts/lib/Either';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';
import * as Task_ from 'fp-ts/lib/Task';
import { Either } from 'fp-ts/lib/Either';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { pipe } from 'fp-ts/lib/pipeable';

import {
  Context,
  Err,
  Examples,
  LiteralBundle,
  LiteralBundleSeed,
  LiteralQuery,
  LiteralQueryPayload,
  LiteralResult,
  LiteralResultPayload,
  QueryProcessor,
  ReduceFailure,
  Reporters,
  Resolvers,
  ResultProcessor,
  examples,
  protocol,
  structuralMismatch,
} from '../scrapql';

// literal query contains static information that can be replaced with another literal

export function processQuery<
  Q extends LiteralQuery<QP>,
  E extends Err<any>,
  C extends Context,
  A extends Resolvers<any>,
  QP extends LiteralQueryPayload<string>,
  RP extends LiteralResultPayload<string>
>(r: RP): QueryProcessor<Q, LiteralResult<QP, RP>, E, C, A> {
  return ({ q }: Q) => (_context: C): ReaderTaskEither<A, E, LiteralResult<QP, RP>> => {
    return (_resolvers) => TaskEither_.right({ q, r });
  };
}

// literal result is known on forehand so we throw it away

export function processResult<
  R extends LiteralResult<any, any>,
  C extends Context,
  A extends Reporters<any>
>(): ResultProcessor<R, C, A> {
  return (_result: R) => (_context: C): ReaderTask<A, void> => {
    return (_reporters) => Task_.of(undefined);
  };
}

export const reduceResult = <L extends LiteralResult<any, any>>(
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
              return Either_.left(structuralMismatch('literal'));
            }
            return Either_.right(a);
          }),
        ),
    ),
  );

export function queryExamples<Q extends LiteralQuery<any>>(
  queries: NonEmptyArray<Q>,
): Examples<Q> {
  return examples(queries);
}

export function resultExamples<R extends LiteralResult<any, any>>(
  results: NonEmptyArray<R>,
): Examples<R> {
  return examples(results);
}

export const bundle = <
  E extends Err<any>,
  C extends Context,
  QA extends Resolvers<any>,
  RA extends Reporters<any>,
  QP extends LiteralQueryPayload<string>,
  RP extends LiteralResultPayload<string>
>(
  seed: LiteralBundleSeed<E, QP, RP>,
): LiteralBundle<E, C, QA, RA, QP, RP> =>
  protocol({
    Query: t.type({ q: seed.QueryPayload }),
    Result: t.type({ q: seed.QueryPayload, r: seed.ResultPayload }),
    Err: seed.Err,
    processQuery: processQuery(seed.ResultPayload.value),
    processResult: processResult(),
    reduceResult,
    queryExamples: queryExamples([{ q: seed.QueryPayload.value }]),
    resultExamples: resultExamples([
      { q: seed.QueryPayload.value, r: seed.ResultPayload.value },
    ]),
  });
