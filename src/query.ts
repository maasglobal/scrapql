import * as Record_ from 'fp-ts/lib/Record';
import { Task, task } from 'fp-ts/lib/Task';
import * as Task_ from 'fp-ts/lib/Task';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';

// all processors share these generic processor types

export type Context = Array<string>;
export type QueryProcessor<Q, R> = (q: Q, ...c: Context) => Task<R>;
export type QueryProcessorFactory<A, Q, R> = (a: A) => QueryProcessor<Q, R>;

// literal query contains static information that can be replaced with another literal

export function literal<A, Q, R>(constant: R): QueryProcessorFactory<A, Q, R> {
  return (_0) => (query: Q, ..._99: Context) => {
    return Task_.of(constant);
  };
}

// leaf query contains information for retrieving a payload

export type LeafQueryConnector<A, R> = (a: A) => (...k: Context) => Task<R>;

export function leaf<A, R>(
  connect: LeafQueryConnector<A, R>,
): QueryProcessorFactory<A, true, R> {
  return (resolvers) => (query: true, ...context: Context): Task<R> =>
    connect(resolvers)(...context);
}

// keys query requests some information that is always present in database

export function keys<A, Q extends Record<I, SQ>, I extends string, SQ, SR>(
  subProcessor: QueryProcessorFactory<A, SQ, SR>,
): QueryProcessorFactory<A, Q, Record<I, SR>> {
  return (resolvers: A) => (query: Q, ...context: Context): Task<Record<I, SR>> =>
    pipe(
      query,
      Record_.mapWithIndex(
        (id: I, subQuery: SQ): Task<SR> =>
          subProcessor(resolvers)(subQuery, id, ...context),
      ),
      Record_.sequence(task),
    );
}

// keys query requests some information that may not be present in database

export type ExistenceCheckConnector<A> = (a: A) => (i: string) => Task<boolean>;

export function ids<A, Q extends Record<I, SQ>, I extends string, SQ, SR>(
  connect: ExistenceCheckConnector<A>,
  subProcessor: QueryProcessorFactory<A, SQ, SR>,
): QueryProcessorFactory<A, Q, Record<I, Option<SR>>> {
  return (resolvers: A) => (query: Q, ...context: Context) => {
    const tasks: Record<I, Task<Option<SR>>> = pipe(
      query,
      Record_.mapWithIndex(
        (id: I, subQuery: SQ): Task<Option<SR>> => {
          return pipe(
            connect(resolvers)(id),
            Task_.chain(
              (exists): Task<Option<SR>> => {
                if (exists) {
                  return pipe(
                    subProcessor(resolvers)(subQuery, id, ...context),
                    Task_.map(Option_.some),
                  );
                }
                return Task_.of(Option_.none);
              },
            ),
          );
        },
      ),
    );
    return Record_.sequence(task)(tasks);
  };
}

// properties query contains optional queries that may or may not be present

export type QueryProcessorFactoryMapping<A, Q, R> = {
  [I in keyof Q & keyof R]: QueryProcessorFactory<A, Required<Q>[I], Required<R>[I]>;
};

export function properties<A, Q, R>(
  processors: QueryProcessorFactoryMapping<A, Q, R>,
): QueryProcessorFactory<A, Q, R> {
  return (resolvers: A) => <P extends string & keyof Q & keyof R>(
    query: Q,
    ...context: Context
  ): Task<R> => {
    const tasks: Record<P, Task<R[P]>> = pipe(
      query,
      Record_.mapWithIndex((property, subQuery: Q[P]) => {
        const processor = processors[property];
        const subResult = processor(resolvers)(subQuery, ...context);
        return subResult;
      }),
    );
    const result: Task<Record<P, R[P]>> = Record_.sequence(task)(tasks);

    return result as Task<R>;
  };
}
