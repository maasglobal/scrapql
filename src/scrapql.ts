import * as t from 'io-ts';
import { Concat, Reverse } from 'typescript-tuple';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { Option } from 'fp-ts/lib/Option';
import { Either } from 'fp-ts/lib/Either';
import { Task } from 'fp-ts/lib/Task';

export { process } from './process';
export { reduce } from './reduce';

export type Json = unknown;

export type Id = string;
export type Key = string;
export type Property = string;
export type Err = Json;

export type ExistenceQuery<Q extends Id = Id> = Q & {
  readonly ExistenceQuery: unique symbol;
};
export const existenceQuery = <I extends Id = Id>(id: I): ExistenceQuery<I> =>
  id as ExistenceQuery<I>;

export type LiteralQuery = Json;
export type LeafQuery = Json;
export type KeysQuery<SQ extends Query = Json, K extends Key = Key> = Record<Key, SQ>;
export type IdsQuery<SQ extends Query = Json, I extends Id = Id> = Record<I, SQ>;
export type PropertiesQuery<
  Q extends { [I in Property]: Query } = { [I in Property]: Json }
> = Partial<Q>;

export type FetchableQuery = LeafQuery | ExistenceQuery<any>;
export type StructuralQuery = LiteralQuery | KeysQuery | IdsQuery | PropertiesQuery;

export type Query = StructuralQuery | FetchableQuery;

export type Existence = boolean;
export type ExistenceResult<E extends Err = Err> = Either<E, Existence>;
export type LiteralResult = Json;
export type LeafResult = Json;
export type KeysResult<SR extends Result = Json, K extends Key = Key> = Record<Key, SR>;
export type IdsResult<
  SR extends Result = Json,
  I extends Id = Id,
  E extends Err = Err
> = Record<I, Either<E, Option<SR>>>;
export type PropertiesResult<
  R extends { [I in Property]: Result } = { [I in Property]: Json }
> = Partial<R>;

export type ReportableResult = LeafResult | ExistenceResult;
export type StructuralResult = LiteralResult | KeysResult | IdsResult | PropertiesResult;

export type Result = StructuralResult | ReportableResult;

export type Context = Array<string>; // really a tuple (T extends Array<string>)

export type ProcessorInstance<I, O> = (i: I) => Task<O>;
export const processorInstance = <I, O, A extends API<any>>(
  builder: Processor<I, O, A, []>,
  api: A,
): ProcessorInstance<I, O> => builder(api)([]);

export type QueryProcessorInstance<Q extends Query, R> = ProcessorInstance<Q, R>;
export type ResultProcessorInstance<R extends Result> = ProcessorInstance<R, void>;

export type Processor<I, O, A extends API<any>, C extends Context> = (
  a: A,
) => (c: C) => ProcessorInstance<I, O>;

export type QueryProcessor<
  Q extends Query,
  R extends Result,
  A extends Resolvers,
  C extends Context = []
> = Processor<Q, R, A, C>;

export type ResultProcessor<
  R extends Result,
  A extends Reporters,
  C extends Context = []
> = Processor<R, void, A, C>;

export type Handler<A extends Array<any>, R> = (...a: A) => Task<R>;

export type API<T> = Record<string, T>;
export type Resolvers = API<any>; // should be API<Resolver>
export type Reporters = API<any>; // should be API<Reporter>

export type Reporter<R extends Result, C extends Context> = Handler<
  Concat<Reverse<C>, [R]>,
  void
>;

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
  Concat<Reverse<C>, [Q]>,
  R
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

export type Results<R extends Result> = NonEmptyArray<R>;
export type ResultReducer<R extends Result> = (r: Results<R>) => R;
export type LeafResultCombiner<R extends Result> = (w: R, r: R) => R;

export type ResultReducerMapping<R extends PropertiesResult> = {
  [I in keyof R]: ResultReducer<Required<R>[I]>;
};

export type Constructor<T> = (...args: any) => T;

export type Protocol<
  Q extends Query,
  R extends Result,
  E extends Err,
  QA extends Resolvers,
  RA extends Reporters
> = {
  Query: t.Type<Q>;
  query: Constructor<Q>;
  Result: t.Type<R>;
  result: Constructor<R>;
  Err: t.Type<E>;
  processResult: ResultProcessor<R, RA>;
  processQuery: QueryProcessor<Q, R, QA>;
  reduceResult: ResultReducer<R>;
};
