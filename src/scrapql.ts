import * as t from 'io-ts';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { Option } from 'fp-ts/lib/Option';
import { Either } from 'fp-ts/lib/Either';
import { Task } from 'fp-ts/lib/Task';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { pipe } from 'fp-ts/lib/pipeable';
import * as Option_ from 'fp-ts/lib/Option';

import { Zero, zero, Prepend, prepend, Onion } from './onion';
import { Dict } from './dict';

export { process } from './process';
export { reduce } from './reduce';

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

export type LiteralQuery = Json;
export type LeafQuery = Json;
export type KeysQuery<SQ extends Query = Json, K extends Key = Key> = Dict<K, SQ>;
export type IdsQuery<SQ extends Query = Json, I extends Id = Id> = Dict<I, SQ>;
export type SearchQuery<SQ extends Query = Json, T extends Terms = Terms> = Dict<T, SQ>;
export type PropertiesQuery<
  Q extends { [I in Property]: Query } = { [I in Property]: Json }
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
export type ExistenceResult<E extends Err = Err> = Either<E, Existence>;
export type TermsResult<I extends Id, E extends Err> = Either<E, Array<I>>;

export type LiteralResult = Json;
export type LeafResult = Json;
export type KeysResult<SR extends Result = Json, K extends Key = Key> = Dict<K, SR>;
export type IdsResult<
  SR extends Result = Json,
  I extends Id = Id,
  E extends Err = Err
> = Dict<I, Either<E, Option<SR>>>;
export type SearchResult<
  SR extends Result = Json,
  T extends Terms = Terms,
  I extends Id = Id,
  E extends Err = Err
> = Dict<T, Either<E, Dict<I, SR>>>;
export type PropertiesResult<
  R extends { [I in Property]: Result } = { [I in Property]: Json }
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
export const processorInstance = <I, O, A extends API<any>, C extends Context>(
  processor: Processor<I, O, A, C>,
  api: A,
  context: C,
): ProcessorInstance<I, O> => (input: I) => processor(input)(context)(api);

export type QueryProcessorInstance<Q extends Query, R extends Result> = ProcessorInstance<
  Q,
  R
>;
export type ResultProcessorInstance<R extends Result> = ProcessorInstance<R, void>;

export type Processor<I, O, A extends API<any>, C extends Context> = (
  i: I,
) => (c: C) => ReaderTask<A, O>;

export type QueryProcessor<
  Q extends Query,
  R extends Result,
  A extends Resolvers,
  C extends Context = Zero
> = Processor<Q, R, A, C>;

export type ResultProcessor<
  R extends Result,
  A extends Reporters,
  C extends Context = Zero
> = Processor<R, void, A, C>;

export type Handler<I, O, C extends Context> = (i: I, c: C) => Task<O>;

export type API<T> = Record<string, T>;
export type Resolvers = API<any>; // should be API<Resolver>
export type Reporters = API<any>; // should be API<Reporter>

export type Reporter<R extends Result, C extends Context> = Handler<R, void, C>;

export type ReporterConnector<
  A extends Reporters,
  R extends Result,
  C extends Context
> = (a: A) => Reporter<R, C>;

export type ResultProcessorMapping<
  A extends Reporters,
  R extends PropertiesResult,
  C extends Context
> = {
  [I in keyof Required<R>]: ResultProcessor<Required<R>[I], A, C>;
};

export type Resolver<Q extends Query, R extends Result, C extends Context> = Handler<
  Q,
  R,
  C
>;

export type ResolverConnector<
  A extends Resolvers,
  Q extends Query,
  R extends Result,
  C extends Context
> = (a: A) => Resolver<Q, R, C>;

export type QueryProcessorMapping<
  A extends Resolvers,
  Q extends PropertiesQuery,
  R extends PropertiesResult,
  C extends Context
> = {
  [I in keyof Q & keyof R]: QueryProcessor<Required<Q>[I], Required<R>[I], A, C>;
};

const MISMATCH = 'Structural mismatch';
export type ReduceeMismatch = typeof MISMATCH;
export const reduceeMismatch: ReduceeMismatch = MISMATCH;

export type ReduceFailure = ReduceeMismatch;

export type ResultReducer<R extends Result> = (
  r: NonEmptyArray<R>,
) => Either<ReduceFailure, R>;
export type LeafResultCombiner<R extends Result> = (w: R, r: R) => R;

export type ResultReducerMapping<R extends PropertiesResult<any>> = {
  [I in keyof R]: ResultReducer<Required<R>[I]>;
};

export type Constructor<T, A extends Args> = (...args: A) => T;

export type QueryConstructorArgs = Args;
export type ResultConstructorArgs = Args;
export type ErrConstructorArgs = Args;

export type QueryConstructor<
  Q extends Query = any, //Query,
  A extends QueryConstructorArgs = QueryConstructorArgs
> = Constructor<Q, A>;

export type ResultConstructor<
  R extends Result = any, //Result,
  A extends ResultConstructorArgs = ResultConstructorArgs
> = Constructor<R, A>;

export type ErrConstructor<
  E extends Err = Err,
  A extends ErrConstructorArgs = ErrConstructorArgs
> = Constructor<E, A>;

export type QueryUtils<
  QC extends QueryConstructor,
  RC extends ResultConstructor,
  QA extends Resolvers
> = {
  Query: t.Type<ReturnType<QC>, Json>;
  query: QC;
  processQuery: QueryProcessor<ReturnType<QC>, ReturnType<RC>, QA>;
};

export type ResultUtils<RC extends ResultConstructor, RA extends Reporters> = {
  Result: t.Type<ReturnType<RC>, Json>;
  result: RC;
  processResult: ResultProcessor<ReturnType<RC>, RA>;
  reduceResult: ResultReducer<ReturnType<RC>>;
};

export type ErrUtils<EC extends ErrConstructor> = {
  Err: t.Type<ReturnType<EC>, Json>;
  err: EC;
};

export type Protocol<
  QC extends QueryConstructor,
  RC extends ResultConstructor,
  EC extends ErrConstructor,
  QA extends Resolvers,
  RA extends Reporters
> = QueryUtils<QC, RC, QA> & ResultUtils<RC, RA> & ErrUtils<EC>;
