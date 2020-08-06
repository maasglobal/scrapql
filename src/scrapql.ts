import * as t from 'io-ts';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { Option } from 'fp-ts/lib/Option';
import { Either } from 'fp-ts/lib/Either';
import { Task } from 'fp-ts/lib/Task';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { pipe } from 'fp-ts/lib/pipeable';
import * as Option_ from 'fp-ts/lib/Option';

import { Zero, zero, Prepend, prepend, Onion } from './utils/onion';
import { Dict as _Dict, dict as _dict } from './utils/dict';
import { NonEmptyList, nonEmptyList } from './utils/non-empty-list';

export * as ids from './shapes/ids';
export * as keys from './shapes/keys';
export * as leaf from './shapes/leaf';
export * as literal from './shapes/literal';
export * as search from './shapes/search';
export * as properties from './shapes/properties';

export type Dict<K, V> = _Dict<K, V>;
export const Dict = _Dict;
export const dict = _dict;

export type Json = unknown;

export type Id<I extends string> = I;
export type Key<K extends string> = K;
export type Property<P extends string> = P;
export type Err<E extends Json> = E;

export type Args<T extends any = any> = Array<T>;

export type Ctx0 = Zero;
export const ctx0 = zero;

export type Ctx<N, C extends Onion<any, any> = Zero> = Prepend<N, C>;
export function ctx<N, A = never, B extends Onion<any, any> = Zero>(
  n: N,
): Prepend<N, Zero>;
export function ctx<N, A = never, B extends Onion<any, any> = Zero>(
  n: N,
  c: Zero,
): Prepend<N, Zero>;
export function ctx<N, A = never, B extends Onion<any, any> = Zero>(
  n: N,
  c: Prepend<A, B>,
): Prepend<N, Prepend<A, B>>;
export function ctx<N, A = never, B extends Onion<any, any> = Zero>(
  n: N,
  c?: Onion<A, B>,
): Prepend<N, Onion<A, B>> {
  return pipe(
    Option_.fromNullable(c),
    Option_.fold(
      () => prepend(n)(ctx0),
      (old: Onion<A, B>): Prepend<N, Onion<A, B>> => prepend(n)(old),
    ),
  );
}

// TODO: with TS4 tuple type Context<C extends Array<any>> = C
export type Context = Onion<any, any> | Zero;

export type ExistenceQuery<Q extends Id<any>> = Q & {
  readonly ExistenceQuery: unique symbol;
};
export const existenceQuery = <I extends Id<any>>(id: I): ExistenceQuery<I> =>
  id as ExistenceQuery<I>;

export type LiteralQuery<Q extends Json & string> = Q;
export type LeafQuery<Q extends Json> = Q;
export type KeysQuery<Q extends Dict<Key<any>, Query<any>>> = Q;
export type IdsQuery<Q extends Dict<Id<any>, Query<any>>> = Q;
export type SearchQuery<Q extends Dict<Terms<any>, Query<any>>> = Q;
export type PropertiesQuery<
  Q extends {
    [I in Property<any>]: Query<any>;
  }
> = Partial<Q>;
export type Terms<T extends Json> = T;
export type TermsQuery<Q extends Terms<any>> = Q & {
  readonly TermsQuery: unique symbol;
};
export const termsQuery = <T extends Terms<any>>(terms: T): TermsQuery<T> =>
  terms as TermsQuery<T>;

export type FetchableQuery<Q extends LeafQuery<any> | ExistenceQuery<any>> = Q;
export type StructuralQuery<
  Q extends
    | LiteralQuery<any>
    | KeysQuery<any>
    | IdsQuery<any>
    | SearchQuery<any>
    | PropertiesQuery<any>
> = Q;

export type Query<Q extends StructuralQuery<any> | FetchableQuery<any>> = Q;

export type Existence = boolean;

export type ExistenceResult<R extends Existence = Existence> = R & {
  readonly ExistenceResult: unique symbol;
};
export const existenceResult = <R extends Existence>(existence: R): ExistenceResult<R> =>
  existence as ExistenceResult<R>;

export type TermsResult<I extends Id<any>> = Array<I>;
export const termsResult = <I extends Id<any>>(ids: Array<I>): TermsResult<I> => ids;

export type LiteralResult<R extends Json & string> = R;
export type LeafResult<R extends Json> = R;
export type KeysResult<R extends Dict<Key<any>, Result<any>>> = R;
export type IdsResult<R extends Dict<Id<any>, Option<Result<any>>>> = R;
export type SearchResult<R extends Dict<Terms<any>, Dict<Id<any>, Result<any>>>> = R;
export type PropertiesResult<
  R extends {
    [I in Property<any>]: Result<any>;
  }
> = Partial<R>;

export type ReportableResult<R extends LeafResult<any> | ExistenceResult<any>> = R;
export type StructuralResult<
  R extends
    | LiteralResult<any>
    | KeysResult<any>
    | IdsResult<any>
    | SearchResult<any>
    | PropertiesResult<any>
> = R;

export type Result<R extends StructuralResult<any> | ReportableResult<any>> = R;

export type Handler<I, O, C extends Context> = (i: I, c: C) => Task<O>;

export type API<A extends { [p: string]: Handler<any, any, any> }> = A;

export type ProcessorInstance<I, O> = (i: I) => Task<O>;
export const processorInstance = <I, O, C extends Context, A extends API<any>>(
  processor: Processor<I, O, C, A>,
  context: C,
  api: A,
): ProcessorInstance<I, O> => (input: I) => processor(input)(context)(api);

export type QueryProcessorInstance<
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>
> = ProcessorInstance<Q, Either<E, R>>;
export type ResultProcessorInstance<R extends Result<any>> = ProcessorInstance<R, void>;

export type Processor<I, O, C extends Context, A extends API<any>> = (
  i: I,
) => (c: C) => ReaderTask<A, O>;

export type Reporter<R extends Result<any>, C extends Context> = Handler<R, void, C>;
export type Reporters<A extends API<{ [p: string]: Reporter<any, any> }>> = A;

export type Resolver<
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>,
  C extends Context
> = Handler<Q, Either<E, R>, C>;
export type Resolvers<A extends API<{ [p: string]: Resolver<any, any, any, any> }>> = A;

export type QueryProcessor<
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>,
  C extends Context,
  A extends Resolvers<any>
> = Processor<Q, Either<E, R>, C, A>;

export type ResultProcessor<
  R extends Result<any>,
  C extends Context,
  A extends Reporters<any>
> = Processor<R, void, C, A>;

export type ReporterConnector<
  R extends Result<any>,
  C extends Context,
  A extends Reporters<any>
> = (a: A) => A[keyof A] & Reporter<R, C>;

export type ResultProcessorMapping<
  R extends PropertiesResult<any>,
  C extends Context,
  A extends Reporters<any>
> = {
  [I in keyof Required<R>]: ResultProcessor<Required<R>[I], C, A>;
};

export type ResolverConnector<
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>,
  C extends Context,
  A extends Resolvers<any>
> = (a: A) => A[keyof A] & Resolver<Q, R, E, C>;

export type QueryProcessorMapping<
  Q extends PropertiesQuery<any>,
  R extends PropertiesResult<any>,
  E extends Err<any>,
  C extends Context,
  A extends Resolvers<any>
> = {
  [I in keyof Q & keyof R]: QueryProcessor<Required<Q>[I], Required<R>[I], E, C, A>;
};

type FailureDescription = string;

const STRUCTURE = 'Unexpected structure';
export type StructuralMismatch = {
  reason: typeof STRUCTURE;
  description: FailureDescription;
};
export const structuralMismatch = (
  description: FailureDescription,
): StructuralMismatch => ({
  reason: STRUCTURE,
  description,
});

const PAYLOAD = 'Unexpected payload';
export type PayloadMismatch = {
  reason: typeof PAYLOAD;
  description: FailureDescription;
};
export const payloadMismatch = (description: FailureDescription): PayloadMismatch => ({
  reason: PAYLOAD,
  description,
});

export type ReduceFailure = StructuralMismatch | PayloadMismatch;

export type ResultReducer<R extends Result<any>> = (
  r: NonEmptyArray<R>,
) => Either<ReduceFailure, R>;

export type Failure = ReduceFailure;

export type LeafResultCombiner<R extends Result<any>> = (
  w: R,
  r: R,
) => Either<PayloadMismatch, R>;

export type ResultReducerMapping<R extends PropertiesResult<any>> = {
  [I in keyof R]: ResultReducer<Required<R>[I]>;
};

export type Constructor<T> = <I extends T>(i: I) => I;

export type Codec<T> = t.Type<T, Json>;

export type QueryCodec<Q extends Query<any>> = Codec<Q>;
export type ResultCodec<R extends Result<any>> = Codec<R>;
export type ErrCodec<E extends Err<any>> = Codec<E>;
export type KeyCodec<K extends Key<any>> = Codec<K>;
export type IdCodec<I extends Id<any>> = Codec<I>;
export type TermsCodec<T extends Terms<any>> = Codec<T>;

export type Codecs<Q extends Query<any>, R extends Result<any>, E extends Err<any>> = {
  Query: QueryCodec<Q>;
  Result: ResultCodec<R>;
  Err: ErrCodec<E>;
};

export type Constructors<
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>
> = {
  query: Constructor<Q>;
  result: Constructor<R>;
  err: Constructor<E>;
};
export const constructors = <
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>
>(
  _codecs: Codecs<Q, R, E>,
): Constructors<Q, R, E> => ({
  query: (q) => q,
  result: (r) => r,
  err: (e) => e,
});

export type Examples<A> = NonEmptyList<A>;
export const examples = nonEmptyList;

export type QueryExamplesMapping<
  P extends Property<string>,
  Q extends PropertiesQuery<{ [I in P]: Query<any> }>
> = {
  [I in keyof Q]: Examples<Required<Q>[I]>;
};
export type ResultExamplesMapping<
  P extends Property<string>,
  R extends PropertiesResult<{ [I in P]: Result<any> }>
> = {
  [I in keyof R]: Examples<Required<R>[I]>;
};

export type ExampleCatalog<Q extends Query<any>, R extends Result<any>> = {
  queryExamples: Examples<Q>;
  resultExamples: Examples<R>;
};

export type QueryUtils<
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>,
  C extends Context,
  QA extends Resolvers<any>
> = {
  processQuery: QueryProcessor<Q, R, E, C, QA>;
};

export type ResultUtils<
  R extends Result<any>,
  C extends Context,
  RA extends Reporters<any>
> = {
  processResult: ResultProcessor<R, C, RA>;
  reduceResult: ResultReducer<R>;
};

export type Fundamentals<
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>,
  C extends Context,
  QA extends Resolvers<any>,
  RA extends Reporters<any>
> = QueryUtils<Q, R, E, C, QA> &
  ResultUtils<R, C, RA> &
  Codecs<Q, R, E> &
  ExampleCatalog<Q, R>;

export type Conveniences<
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>
> = Constructors<Q, R, E>;

export type Protocol<
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>,
  C extends Context,
  QA extends Resolvers<any>,
  RA extends Reporters<any>
> = Fundamentals<Q, R, E, C, QA, RA> & Conveniences<Q, R, E>;

export const protocol = <
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>,
  C extends Context,
  QA extends Resolvers<any>,
  RA extends Reporters<any>
>(
  fundamentals: Fundamentals<Q, R, E, C, QA, RA>,
): Protocol<Q, R, E, C, QA, RA> => ({
  ...fundamentals,
  ...constructors(fundamentals),
});

export type LiteralProtocolSeed<
  Q extends LiteralQuery<string>,
  R extends LiteralResult<string>,
  E extends Err<any>
> = {
  Err: ErrCodec<E>;
  Query: QueryCodec<Q> & t.LiteralC<Q>;
  Result: ResultCodec<R> & t.LiteralC<R>;
};

export type LeafProtocolSeed<
  Q extends Query<any>,
  R extends Result<any>,
  E extends Err<any>,
  C extends Context,
  QA extends Resolvers<any>,
  RA extends Reporters<any>
> = {
  Err: ErrCodec<E>;
  Query: QueryCodec<Q>;
  Result: ResultCodec<R>;
  queryConnector: ResolverConnector<Q, R, E, C, QA>;
  resultConnector: ReporterConnector<R, C, RA>;
  resultCombiner: LeafResultCombiner<R>;
  queryExamplesArray: NonEmptyArray<Q>;
  resultExamplesArray: NonEmptyArray<R>;
};
