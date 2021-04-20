import * as Apply_ from 'fp-ts/lib/Apply';
import * as Array_ from 'fp-ts/lib/Array';
import * as Either_ from 'fp-ts/lib/Either';
import { Either } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';
import * as t from 'io-ts';

import {
  Context,
  Err,
  Examples,
  examples,
  LeafBundle,
  LeafBundleSeed,
  LeafQuery,
  LeafQueryPayload,
  LeafReporterConnector,
  LeafResolverConnector,
  LeafResult,
  LeafResultPayload,
  PayloadMismatch,
  protocol,
  QueryPayloadCombiner,
  QueryProcessor,
  Reporters,
  Resolvers,
  ResultPayloadCombiner,
  ResultProcessor,
  ResultReducer,
  Workspace,
} from '../scrapql';
import * as NonEmptyList_ from '../utils/non-empty-list';
import * as Tuple_ from '../utils/tuple';

// leaf query contains information for retrieving a payload

export function processQuery<
  Q extends LeafQuery<QP>,
  E extends Err<any>,
  C extends Context<Array<any>>,
  W extends Workspace<any>,
  A extends Resolvers<any>,
  QP extends LeafQueryPayload<any>,
  RP extends LeafResultPayload<any>
>(
  connect: LeafResolverConnector<QP, RP, E, C, W, A>,
): QueryProcessor<Q, LeafResult<QP, RP>, E, C, W, A> {
  return ({ q }: Q) => (
    context: C,
    workspace: W,
  ): ReaderTaskEither<A, E, LeafResult<QP, RP>> => {
    return (resolvers) => {
      const resolver = connect(resolvers);
      return pipe(
        resolver(q, context, workspace),
        TaskEither_.map((r) => ({ q, r })),
      );
    };
  };
}

// leaf result contains part of the payload

export function processResult<
  R extends LeafResult<QP, RP>,
  C extends Context<Array<any>>,
  A extends Reporters<any>,
  QP extends LeafQueryPayload<any>,
  RP extends LeafResultPayload<any>
>(connect: LeafReporterConnector<QP, RP, C, A>): ResultProcessor<R, C, A> {
  return ({ q, r }: R) => (context: C): ReaderTask<A, void> => {
    return (reporters) => {
      const reporter = connect(reporters);
      const subContext = pipe(context, Tuple_.prepend(q));
      return reporter(r, subContext, {});
    };
  };
}

export const reduceResult = <
  QP extends LeafQueryPayload<any>,
  RP extends LeafResultPayload<any>
>(
  combineLeafQueryPayload: QueryPayloadCombiner<QP>,
  combineLeafResultPayload: ResultPayloadCombiner<RP>,
): ResultReducer<LeafResult<QP, RP>> => (results) => {
  type R = LeafResult<QP, RP>;
  const combineLeafResult = (
    { q: qw, r: rw }: R,
    { q: qr, r: rr }: R,
  ): Either<PayloadMismatch, R> =>
    pipe(
      {
        q: combineLeafQueryPayload(qw, qr),
        r: combineLeafResultPayload(rw, rr),
      },
      Apply_.sequenceS(Either_.Apply),
    );
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

export function queryExamples<QP extends LeafQueryPayload<any>>(
  qps: NonEmptyArray<QP>,
): Examples<LeafQuery<QP>> {
  return pipe(
    examples(qps),
    NonEmptyList_.map((q) => ({ q })),
  );
}

export function resultExamples<
  QP extends LeafQueryPayload<any>,
  RP extends LeafResultPayload<any>
>(qps: NonEmptyArray<QP>, rps: NonEmptyArray<RP>): Examples<LeafResult<QP, RP>> {
  return NonEmptyList_.sequenceS({
    q: examples(qps),
    r: examples(rps),
  });
}

export const bundle = <
  E extends Err<any>,
  C extends Context<Array<any>>,
  W extends Workspace<any>,
  QA extends Resolvers<any>,
  RA extends Reporters<any>,
  QP extends LeafQueryPayload<any>,
  RP extends LeafResultPayload<any>
>(
  seed: LeafBundleSeed<E, C, W, QA, RA, QP, RP>,
): LeafBundle<E, C, W, QA, RA, QP, RP> =>
  protocol({
    Query: t.type({ q: seed.QueryPayload }),
    Result: t.type({ q: seed.QueryPayload, r: seed.ResultPayload }),
    Err: seed.Err,
    processQuery: processQuery(seed.queryConnector),
    processResult: processResult(seed.resultConnector),
    reduceResult: reduceResult(seed.queryPayloadCombiner, seed.resultPayloadCombiner),
    queryExamples: queryExamples(seed.queryPayloadExamplesArray),
    resultExamples: resultExamples(
      seed.queryPayloadExamplesArray,
      seed.resultPayloadExamplesArray,
    ),
  });
