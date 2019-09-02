import { array } from 'fp-ts/lib/Array';
import * as Array_ from 'fp-ts/lib/Array';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as Record_ from 'fp-ts/lib/Record';
import { Task, taskSeq } from 'fp-ts/lib/Task';
import * as Task_ from 'fp-ts/lib/Task';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';
import { identity } from 'fp-ts/lib/function';

// all processors share these generic processor types

export type ResultProcessor<R> = (r: R, ...c: Array<string>) => Task<void>;
export type ResultProcessorFactory<A, R> = (a: A) => ResultProcessor<R>;

// helper functions

export function literal(): ResultProcessorFactory<unknown, unknown> {
  return (_0) => (_1, ..._99) => Task_.of(undefined);
}

// leaf result contains part of the payload

export type LeafReporterConnector<A, R> = (a: A) => (r: R, ...c: Array<string>) => Task<void>;

export function leaf<A, R>(connect: LeafReporterConnector<A, R>): ResultProcessorFactory<A, R> {
  return (reporters) => (result, ...context) => connect(reporters)(result, ...context);
}

// keys result contains data that always exists in database

export function keys<A, R extends Record<I, SR>, I extends string, SR>(
  subProcessor: ResultProcessorFactory<A, SR>,
): ResultProcessorFactory<A, R> {
  return (reporters: A) => (result: R, ...context: Array<string>) => {
    const tasks: Array<Task<void>> = pipe(
      result,
      Record_.mapWithIndex((key: I, subResult: SR) => subProcessor(reporters)(subResult, key, ...context)),
      Record_.toUnfoldable(array),
      Array_.map(([k, v]) => v),
    );
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}

// ids result contains data that may not exist in database

export type ExistenceReporterConnector<A> = (a: A) => (i: string, b: boolean) => Task<void>;

export function ids<A, R extends Record<I, Option<SR>>, I extends string, SR>(
  connect: ExistenceReporterConnector<A>,
  subProcessor: ResultProcessorFactory<A, SR>,
): ResultProcessorFactory<A, R> {
  return (reporters: A) => (result: R, ...context: Array<string>) => {
    const tasks: Array<Task<void>> = pipe(
      result,
      Record_.mapWithIndex((id: I, maybeSubResult: Option<SR>) => {
        return pipe(
          maybeSubResult,
          Option_.fold(
            () => [connect(reporters)(id, false)],
            (subResult) => [connect(reporters)(id, true), subProcessor(reporters)(subResult, id, ...context)],
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

// properties result contains results for a set of optional queries

export type ResultProcessorFactoryMapping<A, R, P extends keyof R> = Record<P, ResultProcessorFactory<A, R[P]>>

export function properties<A, R, P extends string & keyof R>(
  processors: ResultProcessorFactoryMapping<A, R, P>,
): ResultProcessorFactory<A, R> {
  return (reporters: A) => (result: R, ...context: Array<string>) => {
    const tasks: Array<Task<void>> = pipe(
      result,
      Record_.mapWithIndex((property: P, subResult: R[P]) => {
        const processor = processors[property];
        return processor(reporters)(subResult, ...context);
      }),
      Record_.toUnfoldable(array),
      Array_.map(([k, v]) => v),
    );
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}
