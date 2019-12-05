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

export type Processor<I, O> = (i: I) => Task<O>;
export type QueryProcessor<Q extends Query, R> = Processor<Q, R>;
export type ResultProcessor<R extends Result> = Processor<R, void>;

export type API<T> = Record<string, T>;
export type ResolverAPI = API<any>; // should be API<Resolver>
export type ReporterAPI = API<any>; // should be API<Reporter>

export type Reporter<R extends Result, C extends Context> = (
  ...a: Concat<Reverse<C>, [R]>
) => Task<void>;

export type ReporterConnector<
  A extends ReporterAPI,
  R extends Result,
  C extends Context
> = (a: A) => Reporter<R, C>;

export type ResultProcessorBuilderMapping<
  A extends ReporterAPI,
  R extends PropertiesResult,
  C extends Context
> = {
  [I in keyof Required<R>]: Build<ResultProcessor<Required<R>[I]>, A, C>;
};

export type Resolver<R extends Result, C extends Context> = (...c: Reverse<C>) => Task<R>;

export type ResolverConnector<
  A extends ResolverAPI,
  R extends Result,
  C extends Context
> = (a: A) => Resolver<R, C>;

export type QueryProcessorBuilderMapping<
  A extends ResolverAPI,
  Q extends PropertiesQuery,
  R extends PropertiesResult,
  C extends Context
> = {
  [I in keyof Q & keyof R]: Build<QueryProcessor<Required<Q>[I], Required<R>[I]>, A, C>;
};

export type Build<
  P extends Processor<any, any>,
  A extends API<any>,
  C extends Context
> = (a: A) => (c: C) => P;

export function init<P extends Processor<any, any>, A extends API<any>>(
  builder: Build<P, A, []>,
  api: A,
): P {
  return builder(api)([]);
}

export const process = {
  query,
  result,
};
