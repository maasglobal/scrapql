import { Prepend, Concat, Reverse } from 'typescript-tuple';
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

import * as Tuple_ from './tuple';
import { Build, ResultProcessor, Context } from './types';

// helper functions

export function literal<A, R, C extends Context>(): Build<ResultProcessor<R>, A, C> {
  return (_0: A) => (_1: C) => (_3: R) => Task_.of(undefined);
}

// leaf result contains part of the payload

export type LeafReporterConnector<A, R, C extends Context> = (
  a: A,
) => (...a: Concat<Reverse<C>, [R]>) => Task<void>;

export function leaf<A, R, C extends Context>(
  connect: LeafReporterConnector<A, R, C>,
): Build<ResultProcessor<R>, A, C> {
  return (reporters: A) => (context: C) => (result: R) => {
    const g: Concat<Reverse<C>, [R]> = pipe(
      context,
      Tuple_.reverse,
      Tuple_.concat([result] as [R]),
    );
    return connect(reporters)(...g);
  };
}

// keys result contains data that always exists in database

export function keys<
  A,
  R extends Record<string, SR>,
  I extends string & keyof R,
  SR,
  C extends Context
>(
  subProcessor: Build<ResultProcessor<SR>, A, Prepend<C, I>>,
): Build<ResultProcessor<R>, A, C> {
  return (reporters: A) => (context: C) => (result: R) => {
    const tasks: Array<Task<void>> = pipe(
      result,
      Record_.mapWithIndex((key: I, subResult: SR) => {
        const subContext = pipe(
          context,
          Tuple_.prepend(key),
        );
        return subProcessor(reporters)(subContext)(subResult);
      }),
      Record_.toUnfoldable(array),
      Array_.map(([k, v]) => v),
    );
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}

// ids result contains data that may not exist in database

export type ExistenceReporterConnector<A, I extends string> = (
  a: A,
) => (i: I, b: boolean) => Task<void>;

export function ids<
  A,
  R extends Record<string, Option<SR>>,
  I extends string & keyof R,
  SR,
  C extends Context
>(
  connect: ExistenceReporterConnector<A, I>,
  subProcessor: Build<ResultProcessor<SR>, A, Prepend<C, I>>,
): Build<ResultProcessor<R>, A, C> {
  return (reporters: A) => (context: C) => (result: R) => {
    const tasks: Array<Task<void>> = pipe(
      result,
      Record_.mapWithIndex((id: I, maybeSubResult: Option<SR>) => {
        const subContext = pipe(
          context,
          Tuple_.prepend(id),
        );
        return pipe(
          maybeSubResult,
          Option_.fold(
            () => [connect(reporters)(id, false)],
            (subResult) => [
              connect(reporters)(id, true),
              subProcessor(reporters)(subContext)(subResult),
            ],
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

export type ResultProcessorBuilderMapping<A, R, C extends Context> = {
  [I in keyof Required<R>]: Build<ResultProcessor<Required<R>[I]>, A, C>;
};

export function properties<A, R, C extends Context>(
  processors: ResultProcessorBuilderMapping<A, R, C>,
): Build<ResultProcessor<R>, A, C> {
  return (reporters: A) => (context: C) => <P extends string & keyof R>(
    result: R,
  ): Task<void> => {
    const taskRecord: Record<P, Task<void>> = pipe(
      result,
      Record_.mapWithIndex((property, subResult: R[P]) => {
        const processor = processors[property];
        return processor(reporters)(context)(subResult);
      }),
    );
    const tasks: Array<Task<void>> = pipe(
      taskRecord,
      Record_.toUnfoldable(array),
      Array_.map(([k, v]) => v),
    );
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}
