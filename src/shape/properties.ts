import * as Array_ from 'fp-ts/lib/Array';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import * as Record_ from 'fp-ts/lib/Record';
import { Either, either } from 'fp-ts/lib/Either';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { Task, task, taskSeq } from 'fp-ts/lib/Task';
import { array } from 'fp-ts/lib/Array';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';

import {
  Context,
  PropertiesQuery,
  PropertiesResult,
  Property,
  QueryProcessor,
  QueryProcessorMapping,
  ReduceFailure,
  Reporters,
  Resolvers,
  ResultProcessor,
  ResultProcessorMapping,
  ResultReducer,
  ResultReducerMapping,
} from '../scrapql';

// properties query contains optional queries that may or may not be present

export function processQuery<
  A extends Resolvers,
  Q extends PropertiesQuery,
  R extends PropertiesResult,
  C extends Context
>(processors: QueryProcessorMapping<A, Q, R, C>): QueryProcessor<Q, R, A, C> {
  return <P extends Property & keyof Q & keyof R>(query: Q) => (
    context: C,
  ): ReaderTask<A, R> => {
    return (resolvers) => {
      const tasks: Record<P, Task<R[P]>> = pipe(
        query,
        Record_.mapWithIndex((property, subQuery: Q[P]) => {
          const processor = processors[property];
          const subResult = processor(subQuery)(context)(resolvers);
          return subResult;
        }),
      );
      const result: Task<Record<P, R[P]>> = Record_.sequence(task)(tasks);

      return result as Task<R>;
    };
  };
}

// properties result contains results for a set of optional queries

export function processResult<
  A extends Reporters,
  R extends PropertiesResult,
  C extends Context
>(processors: ResultProcessorMapping<A, R, C>): ResultProcessor<R, A, C> {
  return <P extends Property & keyof R>(result: R) => (
    context: C,
  ): ReaderTask<A, void> => {
    return (reporters): Task<void> => {
      const taskRecord: Record<P, Task<void>> = pipe(
        result,
        Record_.mapWithIndex((property, subResult: R[P]) => {
          const processor = processors[property];
          return processor(subResult)(context)(reporters);
        }),
      );
      const tasks: Array<Task<void>> = pipe(
        taskRecord,
        Record_.toUnfoldable(array),
        Array_.map(([_k, v]) => v),
      );
      return Foldable_.traverse_(taskSeq, array)(tasks, identity);
    };
  };
}

export const reduceResult = <R extends PropertiesResult>(
  processors: ResultReducerMapping<R>,
) => <P extends Property & keyof R>(
  results: NonEmptyArray<R>,
): Either<ReduceFailure, R> => {
  const omg: Record<P, Either<ReduceFailure, R[P]>> = pipe(
    NonEmptyArray_.head(results),
    Record_.mapWithIndex<P, unknown, Either<ReduceFailure, R[P]>>(
      (propName: P): Either<ReduceFailure, R[P]> => {
        const propReducer: ResultReducer<R[P]> = processors[propName];
        return pipe(
          results,
          NonEmptyArray_.map((r: R): R[P] => r[propName]),
          propReducer,
          (x: Either<ReduceFailure, R[P]>) => x,
        );
      },
    ),
  ) as Record<P, Either<ReduceFailure, R[P]>>;
  const result: Either<ReduceFailure, Record<P, R[P]>> = Record_.sequence(either)(omg);
  return result as Either<ReduceFailure, R>;
};
