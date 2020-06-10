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
import { NEGenF, neGenF } from './utils/negf';

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

export type Id = string;
export type Key = string;
export type Property = string;
export type Err = Json;

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

export type Context = Ctx<any, any> | Ctx0;

export type ExistenceQuery<Q extends Id = Id> = Q & {
  readonly ExistenceQuery: unique symbol;
};
export const existenceQuery = <I extends Id = Id>(id: I): ExistenceQuery<I> =>
  id as ExistenceQuery<I>;

export type LiteralQuery = Json & string;
export type LeafQuery = Json;
export type KeysQuery<SQ extends Query = Json, K extends Key = Key> = Dict<K, SQ>;
export type IdsQuery<SQ extends Query = Json, I extends Id = Id> = Dict<I, SQ>;
export type SearchQuery<SQ extends Query = Json, T extends Terms = Terms> = Dict<T, SQ>;
export type PropertiesQuery<
  Q extends {
    [I in Property]: Query;
  } = {
    [I in Property]: Json;
  }
> = Partial<Q>;
export type Terms = Json;
export type TermsQuery<Q extends Terms> = Q & {
  readonly TermsQuery: unique symbol;
};
export const termsQuery = <T extends Terms>(terms: T): TermsQuery<T> =>
  terms as TermsQuery<T>;

export type FetchableQuery = LeafQuery | ExistenceQuery<any>;
export type StructuralQuery =
  | LiteralQuery
  | KeysQuery
  | IdsQuery
  | SearchQuery
  | PropertiesQuery;

export type Query = StructuralQuery | FetchableQuery;

export type Existence = boolean;

export type ExistenceResult<R extends Existence = Existence> = R & {
  readonly ExistenceResult: unique symbol;
};
export const existenceResult = <R extends Existence>(existence: R): ExistenceResult<R> =>
  existence as ExistenceResult<R>;

export type TermsResult<I extends Id> = Array<I>;
export const termsResult = <I extends Id>(ids: Array<I>): TermsResult<I> => ids;

export type LiteralResult = Json & string;
export type LeafResult = Json;
export type KeysResult<SR extends Result = Json, K extends Key = Key> = Dict<K, SR>;
export type IdsResult<SR extends Result = Json, I extends Id = Id> = Dict<I, Option<SR>>;
export type SearchResult<
  SR extends Result = Json,
  T extends Terms = Terms,
  I extends Id = Id
> = Dict<T, Dict<I, SR>>;
export type PropertiesResult<
  R extends {
    [I in Property]: Result;
  } = {
    [I in Property]: Json;
  }
> = Partial<R>;

export type ReportableResult = LeafResult | ExistenceResult;
export type StructuralResult =
  | LiteralResult
  | KeysResult
  | IdsResult
  | SearchResult
  | PropertiesResult;

export type Result = StructuralResult | ReportableResult;

export type ProcessorInstance<I, O> = (i: I) => Task<O>;
export const processorInstance = <I, O, C extends Context, A extends API<any>>(
  processor: Processor<I, O, C, A>,
  context: C,
  api: A,
): ProcessorInstance<I, O> => (input: I) => processor(input)(context)(api);

export type QueryProcessorInstance<
  Q extends Query,
  R extends Result,
  E extends Err
> = ProcessorInstance<Q, Either<E, R>>;
export type ResultProcessorInstance<R extends Result> = ProcessorInstance<R, void>;

export type Processor<I, O, C extends Context, A extends API<any>> = (
  i: I,
) => (c: C) => ReaderTask<A, O>;

export type QueryProcessor<
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context,
  A extends Resolvers
> = Processor<Q, Either<E, R>, C, A>;

export type ResultProcessor<
  R extends Result,
  C extends Context,
  A extends Reporters
> = Processor<R, void, C, A>;

export type Handler<I, O, C extends Context> = (i: I, c: C) => Task<O>;

export type API<T> = Record<string, T>;
export type Resolvers = API<any>; // should be API<Resolver>
export type Reporters = API<any>; // should be API<Reporter>

export type Reporter<R extends Result, C extends Context> = Handler<R, void, C>;

export type ReporterConnector<
  R extends Result,
  C extends Context,
  A extends Reporters
> = (a: A) => Reporter<R, C>;

export type ResultProcessorMapping<
  R extends PropertiesResult,
  C extends Context,
  A extends Reporters
> = {
  [I in keyof Required<R>]: ResultProcessor<Required<R>[I], C, A>;
};

export type Resolver<
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context
> = Handler<Q, Either<E, R>, C>;

export type ResolverConnector<
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context,
  A extends Resolvers
> = (a: A) => Resolver<Q, R, E, C>;

export type QueryProcessorMapping<
  Q extends PropertiesQuery,
  R extends PropertiesResult,
  E extends Err,
  C extends Context,
  A extends Resolvers
> = {
  [I in keyof Q & keyof R]: QueryProcessor<Required<Q>[I], Required<R>[I], E, C, A>;
};

const MISMATCH = 'Structural mismatch';
export type ReduceeMismatch = typeof MISMATCH;
export const reduceeMismatch: ReduceeMismatch = MISMATCH;

export type ReduceFailure = ReduceeMismatch;

export type ResultReducer<R extends Result> = (
  r: NonEmptyArray<R>,
) => Either<ReduceFailure, R>;

export type Failure = ReduceFailure;

export type LeafResultCombiner<R extends Result> = (w: R, r: R) => R;

export type ResultReducerMapping<R extends PropertiesResult<any>> = {
  [I in keyof R]: ResultReducer<Required<R>[I]>;
};

export type Constructor<T> = <I extends T>(i: I) => I;

export type Codec<T> = t.Type<T, Json>;

export type QueryCodec<Q extends Query> = Codec<Q>;
export type ResultCodec<R extends Result> = Codec<R>;
export type ErrCodec<E extends Err> = Codec<E>;
export type KeyCodec<K extends Key> = Codec<K>;
export type IdCodec<I extends Id> = Codec<I>;
export type TermsCodec<T extends Terms> = Codec<T>;

export type Codecs<Q extends Query, R extends Result, E extends Err> = {
  Query: QueryCodec<Q>;
  Result: ResultCodec<R>;
  Err: ErrCodec<E>;
};

export type Constructors<Q extends Query, R extends Result, E extends Err> = {
  query: Constructor<Q>;
  result: Constructor<R>;
  err: Constructor<E>;
};
export const constructors = <Q extends Query, R extends Result, E extends Err>(
  _codecs: Codecs<Q, R, E>,
): Constructors<Q, R, E> => ({
  query: (q) => q,
  result: (r) => r,
  err: (e) => e,
});

export type Examples<A> = NEGenF<A>;
export const examples = neGenF;

export type QueryExamplesMapping<Q extends PropertiesQuery<any>> = {
  [I in keyof Q]: Examples<Required<Q>[I]>;
};
export type ResultExamplesMapping<R extends PropertiesResult<any>> = {
  [I in keyof R]: Examples<Required<R>[I]>;
};

export type ExampleCatalog<Q extends Query, R extends Result> = {
  queryExamples: Examples<Q>;
  resultExamples: Examples<R>;
};

export type QueryUtils<
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context,
  QA extends Resolvers
> = {
  processQuery: QueryProcessor<Q, R, E, C, QA>;
};

export type ResultUtils<R extends Result, C extends Context, RA extends Reporters> = {
  processResult: ResultProcessor<R, C, RA>;
  reduceResult: ResultReducer<R>;
};

export type Fundamentals<
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context,
  QA extends Resolvers,
  RA extends Reporters
> = QueryUtils<Q, R, E, C, QA> &
  ResultUtils<R, C, RA> &
  Codecs<Q, R, E> &
  ExampleCatalog<Q, R>;

export type Conveniences<Q extends Query, R extends Result, E extends Err> = Constructors<
  Q,
  R,
  E
>;

export type Protocol<
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context,
  QA extends Resolvers,
  RA extends Reporters
> = Fundamentals<Q, R, E, C, QA, RA> & Conveniences<Q, R, E>;

export const protocol = <
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context,
  QA extends Resolvers,
  RA extends Reporters
>(
  fundamentals: Fundamentals<Q, R, E, C, QA, RA>,
): Protocol<Q, R, E, C, QA, RA> => ({
  ...fundamentals,
  ...constructors(fundamentals),
});

export type LiteralProtocolSeed<
  Q extends LiteralQuery,
  R extends LiteralResult,
  E extends Err
> = {
  Err: ErrCodec<E>;
  Query: QueryCodec<Q> & t.LiteralC<Q>;
  Result: ResultCodec<R> & t.LiteralC<R>;
};

export type LeafProtocolSeed<
  Q extends Query,
  R extends Result,
  E extends Err,
  C extends Context,
  QA extends Resolvers,
  RA extends Reporters
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
