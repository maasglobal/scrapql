import { Concat, Reverse } from 'typescript-tuple';
import { Task } from 'fp-ts/lib/Task';
import * as query from './query';
import * as result from './result';

export type Json = unknown;

export type Query = Json;
export type Result = Json;

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
  R extends Result,
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
  Q extends Query,
  R extends Result,
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
