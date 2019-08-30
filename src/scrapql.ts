import { array } from 'fp-ts/lib/Array';
import * as Array_ from 'fp-ts/lib/Array';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as Record_ from 'fp-ts/lib/Record';
import { Task, task, taskSeq } from 'fp-ts/lib/Task';
import * as Task_ from 'fp-ts/lib/Task';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';
import { identity } from 'fp-ts/lib/function';

// all processors share these generic processor types

export type ResultProcessor<A, R> = (a: A, r: R, ...c: Array<string>) => Task<void>;
export type QueryProcessor<A, Q, R> = (a: A, q: Q, ...c: Array<string>) => Task<R>;

// helper functions

export const discard: ResultProcessor<unknown, unknown> = (_0, _1, ..._99) => Task_.of(undefined);
export const replaceWith = <C>(constant: C): QueryProcessor<unknown, unknown, C> => (_0, _1, ..._99) =>
  Task_.of(constant);

// fields result contains part of the payload

type FieldsReporterConnector<A, R> = (a: A) => (r: R, ...c: Array<string>) => Task<void>;

export function processResultFields<A, R>(connect: FieldsReporterConnector<A, R>): ResultProcessor<A, R> {
  return (reporters, result, ...context) => connect(reporters)(result, ...context);
}

// keys result contains data that always exists in database

export function processResultKeys<A, R extends Record<I, SR>, I extends string, SR>(
  subProcessor: ResultProcessor<A, SR>,
): ResultProcessor<A, R> {
  return (reporters: A, result: R, ...context: Array<string>) => {
    const tasks: Array<Task<void>> = pipe(
      result,
      Record_.mapWithIndex((key: I, subResult: SR) => subProcessor(reporters, subResult, key, ...context)),
      Record_.toUnfoldable(array),
      Array_.map(([k, v]) => v),
    );
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}

// ids result contains data that may not exist in database

type ExistenceReporterConnector<A> = (a: A) => (i: string, b: boolean) => Task<void>;

export function processResultIds<A, R extends Record<I, Option<SR>>, I extends string, SR>(
  connect: ExistenceReporterConnector<A>,
  subProcessor: ResultProcessor<A, SR>,
): ResultProcessor<A, R> {
  return (reporters: A, result: R, ...context: Array<string>) => {
    const tasks: Array<Task<void>> = pipe(
      result,
      Record_.mapWithIndex((id: I, maybeSubResult: Option<SR>) => {
        return pipe(
          maybeSubResult,
          Option_.fold(
            () => [connect(reporters)(id, false)],
            (subResult) => [connect(reporters)(id, true), subProcessor(reporters, subResult, id, ...context)],
          ),
        );
      }),
      Record_.toUnfoldable(array),
      Array_.map(([k, v]) => v),
      Array_.flatten,
    );
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}

// properties result contains results for a set of optional query fields

type ResultProcessorMapping<A, R, P extends keyof R> = Record<P, (a: A, q: R[P], ...c: Array<string>) => Task<void>>;

export function processResultProperties<A, R, P extends string & keyof R>(
  processors: ResultProcessorMapping<A, R, P>,
): ResultProcessor<A, R> {
  return (reporters: A, result: R, ...context: Array<string>) => {
    const tasks: Array<Task<void>> = pipe(
      result,
      Record_.mapWithIndex((property: P, subResult: R[P]) => {
        const processor = processors[property];
        return processor(reporters, subResult, ...context);
      }),
      Record_.toUnfoldable(array),
      Array_.map(([k, v]) => v),
    );
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}

// fields query contains information for retrieving a payload

type FieldsQueryConnector<A, R> = (a: A) => (...k: Array<string>) => Task<R>;

export function processQueryFields<A, R>(connect: FieldsQueryConnector<A, R>): QueryProcessor<A, true, R> {
  return (resolvers, query, ...context) => connect(resolvers)(...context);
}

// keys query requests some information that is always present in database

export function processQueryKeys<A, Q extends Record<I, SQ>, I extends string, SQ, SR>(
  subProcessor: QueryProcessor<A, SQ, SR>,
): QueryProcessor<A, Q, Record<I, SR>> {
  return (resolvers: A, query: Q, ...context: Array<string>) => {
    const foo: Task<Record<I, SR>> = pipe(
      query,
      Record_.mapWithIndex((id: I, subQuery: SQ): Task<SR> => subProcessor(resolvers, subQuery, id, ...context)),
      Record_.sequence(task),
    );
    return foo;
  };
}

// keys query requests some information that may not be present in database

type ExistenceCheckConnector<A> = (a: A) => (i: string) => Task<boolean>;

export function processQueryIds<A, Q extends Record<I, SQ>, I extends string, SQ, SR>(
  connect: ExistenceCheckConnector<A>,
  subProcessor: QueryProcessor<A, SQ, SR>,
): QueryProcessor<A, Q, Record<I, Option<SR>>> {
  return (resolvers: A, query: Q, ...context: Array<string>) => {
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
                    subProcessor(resolvers, subQuery, id, ...context),
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

type QueryProcessorMapping<
  A,
  Q extends Record<string, any>,
  R extends Record<keyof Q, any>,
  P extends keyof Q & keyof R
> = Record<P, (a: A, q: Q[P], ...c: Array<string>) => Task<R[P]>>;

export function processQueryProperties<
  A,
  Q extends Record<string, any>,
  R extends Record<keyof Q, any>,
  P extends string & keyof Q & keyof R
>(processors: QueryProcessorMapping<A, Q, R, P>): QueryProcessor<A, Q, Record<P, R[P]>> {
  return (resolvers: A, query: Q, ...context: Array<string>) => {
    const tasks: Record<P, Task<R[P]>> = pipe(
      query,
      Record_.mapWithIndex((property, subQuery: Q[P]) => {
        const processor = processors[property];
        const subResult = processor(resolvers, subQuery, ...context);
        return subResult;
      }),
    );
    return Record_.sequence(task)(tasks);
  };
}
