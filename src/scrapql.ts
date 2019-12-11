import * as t from 'io-ts';
import { Concat, Reverse } from 'typescript-tuple';
import { Option } from 'fp-ts/lib/Option';
import { Either } from 'fp-ts/lib/Either';
import { Task } from 'fp-ts/lib/Task';
import * as query from './query';
import * as result from './result';

export type Json = unknown;

export type Id = string;
export type Key = string;
export type Property = string;
export type Err = Json;

export type ExistenceQuery = never; // the query is implicit
export type LiteralQuery = Json;
export type LeafQuery = true;
export type KeysQuery<S extends Query = Json> = Record<Key, S>;
export type IdsQuery<S extends Query = Json> = Record<Id, S>;
export type PropertiesQuery<
  Q extends { [I in Property]: Query } = { [I in Property]: Json }
> = Partial<Q>;

export type FetchableQuery = LeafQuery | ExistenceQuery;
export type StructuralQuery = LiteralQuery | KeysQuery | IdsQuery | PropertiesQuery;

export type Query = StructuralQuery | FetchableQuery;

export type Existence = boolean;
export type ExistenceResult<E extends Err = Err> = Either<E, Existence>;
export type LiteralResult = Json;
export type LeafResult = Json;
export type KeysResult<S extends Result = Json> = Record<Key, S>;
export type IdsResult<S extends Result = Json, E extends Err = Err> = Record<
  Id,
  Either<E, Option<S>>
>;
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

export type Resolver<R extends Result, C extends Context> = Handler<Reverse<C>, R>;

export type ResolverConnector<
  A extends Resolvers,
  R extends Result,
  C extends Context
> = (a: A) => Resolver<R, C>;

export type QueryProcessorMapping<
  A extends Resolvers,
  Q extends PropertiesQuery,
  R extends PropertiesResult,
  C extends Context
> = {
  [I in keyof Q & keyof R]: QueryProcessor<Required<Q>[I], Required<R>[I], A, C>;
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
};

export const process = {
  query,
  result,
};
