import { Prepend, Concat, Reverse } from 'typescript-tuple';
import { array } from 'fp-ts/lib/Array';
import * as Array_ from 'fp-ts/lib/Array';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as Record_ from 'fp-ts/lib/Record';
import { Task, taskSeq } from 'fp-ts/lib/Task';
import * as Task_ from 'fp-ts/lib/Task';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';
import { Either } from 'fp-ts/lib/Either';
import * as Either_ from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import { identity } from 'fp-ts/lib/function';

import * as Tuple_ from './tuple';
import {
  ResultProcessor,
  Result,
  Context,
  ReporterConnector,
  Reporters,
  ResultProcessorMapping,
  LiteralResult,
  LeafResult,
  Key,
  KeysResult,
  Id,
  ExistenceResult,
  IdsResult,
  Property,
  PropertiesResult,
  ReportableResult,
  Existence,
  Err,
} from './scrapql';

// helper functions

function reporterArgsFrom<R extends ReportableResult, C extends Context>(
  context: C,
  result: R,
): Concat<Reverse<C>, [R]> {
  return pipe(
    context,
    Tuple_.reverse,
    Tuple_.concat([result] as [R]),
  );
}

// literal result is known on forehand so we throw it away

export function literal<
  A extends Reporters,
  R extends LiteralResult,
  C extends Context
>(): ResultProcessor<R, A, C> {
  return (_0: A) => (_1: C) => (_3: R) => Task_.of(undefined);
}

// leaf result contains part of the payload

export function leaf<A extends Reporters, R extends LeafResult, C extends Context>(
  connect: ReporterConnector<A, R, C>,
): ResultProcessor<R, A, C> {
  return (reporters: A) => (context: C) => (result: R) => {
    return connect(reporters)(...reporterArgsFrom(context, result));
  };
}

// keys result contains data that always exists in database

export function keys<
  A extends Reporters,
  R extends KeysResult<SR>,
  K extends Key & keyof R,
  SR extends Result,
  C extends Context
>(subProcessor: ResultProcessor<SR, A, Prepend<C, K>>): ResultProcessor<R, A, C> {
  return (reporters: A) => (context: C) => (result: R) => {
    const tasks: Array<Task<void>> = pipe(
      result,
      Record_.mapWithIndex((key: K, subResult: SR) => {
        const subContext = pipe(
          context,
          Tuple_.prepend(key),
        );
        return subProcessor(reporters)(subContext)(subResult);
      }),
      Record_.toUnfoldable(array),
      Array_.map(([_k, v]) => v),
    );
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}

// ids result contains data that may not exist in database

export function ids<
  A extends Reporters,
  R extends IdsResult<SR, E>,
  I extends Id & keyof R,
  SR extends Result,
  C extends Context,
  E extends Err
>(
  connect: ReporterConnector<A, ExistenceResult<E>, Prepend<C, I>>,
  subProcessor: ResultProcessor<SR, A, Prepend<C, I>>,
): ResultProcessor<R, A, C> {
  return (reporters: A) => (context: C) => (result: R) => {
    const tasks: Array<Task<void>> = pipe(
      result,
      Record_.mapWithIndex((id: I, maybeSubResult: Either<E, Option<SR>>) => {
        const subContext = pipe(
          context,
          Tuple_.prepend(id),
        );
        return pipe(
          maybeSubResult,
          Either_.fold(
            (err) => [
              connect(reporters)(
                ...reporterArgsFrom(subContext, Either_.left<E, Existence>(err)),
              ),
            ],
            (opt) =>
              pipe(
                opt,
                Option_.fold(
                  () => [
                    connect(reporters)(
                      ...reporterArgsFrom(subContext, Either_.right<E, Existence>(false)),
                    ),
                  ],
                  (subResult) => [
                    connect(reporters)(
                      ...reporterArgsFrom(subContext, Either_.right<E, Existence>(true)),
                    ),
                    subProcessor(reporters)(subContext)(subResult),
                  ],
                ),
              ),
          ),
        );
      }),
      Record_.toUnfoldable(array),
      Array_.map(([_k, v]) => v),
      Array_.flatten,
    );
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}

// properties result contains results for a set of optional queries

export function properties<
  A extends Reporters,
  R extends PropertiesResult,
  C extends Context
>(processors: ResultProcessorMapping<A, R, C>): ResultProcessor<R, A, C> {
  return (reporters: A) => (context: C) => <P extends Property & keyof R>(
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
      Array_.map(([_k, v]) => v),
    );
    return Foldable_.traverse_(taskSeq, array)(tasks, identity);
  };
}
