import * as Array_ from 'fp-ts/lib/Array';
import { Either } from 'fp-ts/lib/Either';
import * as Either_ from 'fp-ts/lib/Either';
import * as Foldable_ from 'fp-ts/lib/Foldable';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/function';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as Option_ from 'fp-ts/lib/Option';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import * as Record_ from 'fp-ts/lib/Record';
import { Task } from 'fp-ts/lib/Task';
import * as Task_ from 'fp-ts/lib/Task';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import * as TaskEither_ from 'fp-ts/lib/TaskEither';
import * as t from 'io-ts';

import {
  BundleMapping,
  Context,
  Err,
  ErrCodec,
  Examples,
  PropertiesBundle,
  PropertiesBundleSeed,
  PropertiesQuery,
  PropertiesResult,
  Property,
  protocol,
  Query,
  QueryExamplesMapping,
  QueryProcessor,
  QueryProcessorMapping,
  ReduceFailure,
  Reporters,
  Resolvers,
  Result,
  ResultExamplesMapping,
  ResultProcessor,
  ResultProcessorMapping,
  ResultReducer,
  ResultReducerMapping,
  Workspace,
} from '../scrapql';
import * as NonEmptyList_ from '../utils/non-empty-list';

// properties query contains optional queries that may or may not be present

export function processQuery<
  Q extends PropertiesQuery<any>,
  E extends Err<any>,
  C extends Context<Array<any>>,
  W extends Workspace<any>,
  A extends Resolvers<any>,
  R extends PropertiesResult<any>
>(processors: QueryProcessorMapping<Q, R, E, C, W, A>): QueryProcessor<Q, R, E, C, W, A> {
  return <P extends Property<string> & keyof Q & keyof R>(query: Q) => (
    context: C,
    workspace: W,
  ): ReaderTaskEither<A, E, R> => {
    return (resolvers) => {
      const tasks: Record<P, TaskEither<E, R[P]>> = pipe(
        query,
        Record_.mapWithIndex((property, subQuery: Q[P]) => {
          const processor = processors[property];
          const subResult = processor(subQuery)(context, workspace)(resolvers);
          return subResult;
        }),
      );
      const result: TaskEither<E, Record<P, R[P]>> = Record_.sequence(
        TaskEither_.ApplicativePar,
      )(tasks);

      return result as TaskEither<E, R>;
    };
  };
}

// properties result contains results for a set of optional queries

export function processResult<
  R extends PropertiesResult<any>,
  C extends Context<Array<any>>,
  A extends Reporters<any>
>(processors: ResultProcessorMapping<R, C, A>): ResultProcessor<R, C, A> {
  return <P extends Property<string> & keyof R>(result: R) => (
    context: C,
  ): ReaderTask<A, void> => {
    return (reporters): Task<void> => {
      const taskRecord: Record<P, Task<void>> = pipe(
        result,
        Record_.mapWithIndex((property, subResult: R[P]) => {
          const processor = processors[property];
          return processor(subResult)(context, {})(reporters);
        }),
      );
      const tasks: Array<Task<void>> = pipe(
        taskRecord,
        Record_.toUnfoldable(Array_.Unfoldable),
        Array_.map(([_k, v]) => v),
      );
      return Foldable_.traverse_(Task_.ApplicativeSeq, Array_.Foldable)(tasks, identity);
    };
  };
}

export const reduceResult = <R extends PropertiesResult<any>>(
  processors: ResultReducerMapping<R>,
): ResultReducer<R> => <P extends Property<string> & keyof R>(
  results: NonEmptyArray<R>,
): Either<ReduceFailure, R> => {
  const result: Either<ReduceFailure, Record<P, R[P]>> = pipe(
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
    Record_.sequence(Either_.Applicative),
  );
  return result as Either<ReduceFailure, R>;
};

export function queryExamples<
  P extends Property<string>,
  Q extends PropertiesQuery<{ [I in P]: Query<any> }>
>(subQueries: QueryExamplesMapping<P, Q>): Examples<Q> {
  return NonEmptyList_.sequenceS(subQueries) as Examples<Q>;
}

export function resultExamples<
  P extends Property<string>,
  R extends PropertiesResult<{ [I in P]: Result<any> }>
>(subResults: ResultExamplesMapping<P, R>): Examples<R> {
  return NonEmptyList_.sequenceS(subResults) as Examples<R>;
}

export const bundle = <O extends BundleMapping<any, any>>(
  subProtocols: PropertiesBundleSeed<O>,
): PropertiesBundle<O> =>
  protocol({
    Query: t.partial(
      pipe(
        subProtocols,
        Record_.map((subProtocol: any) => subProtocol.Query) as any,
        (x) => x as { [I in keyof O]: O[I]['Query'] },
      ),
    ),
    Result: t.partial(
      pipe(
        subProtocols,
        Record_.map((subProtocol: any) => subProtocol.Result),
        (x) => x as { [I in keyof O]: O[I]['Result'] },
      ),
    ),
    Err: pipe(
      subProtocols,
      Record_.map((subProtocol: any) => subProtocol.Err),
      (x) => x as { [I in keyof O]: O[I]['Err'] },
      Record_.toArray,
      Array_.map(([_k, v]) => v),
      NonEmptyArray_.fromArray,
      Option_.fold(
        (): ErrCodec<any> => t.unknown,
        ([Err]) => Err,
      ),
    ),
    processQuery: processQuery(
      pipe(
        subProtocols,
        Record_.map((subProtocol: any) => subProtocol.processQuery),
        (x) => x as { [I in keyof O]: O[I]['processQuery'] },
      ),
    ),
    processResult: processResult(
      pipe(
        subProtocols,
        Record_.map((subProtocol: any) => subProtocol.processResult),
        (x) => x as any,
      ),
    ),
    reduceResult: reduceResult(
      pipe(
        subProtocols,
        Record_.map((subProtocol: any) => subProtocol.reduceResult),
        (x) => x as any,
      ),
    ),
    queryExamples: queryExamples(
      pipe(
        subProtocols,
        Record_.map((subProtocol: any) => subProtocol.queryExamples),
        (x) => x as { [I in keyof O]: O[I]['queryExamples'] },
      ),
    ),
    resultExamples: resultExamples(
      pipe(
        subProtocols,
        Record_.map((subProtocol: any) => subProtocol.resultExamples),
        (x) => x as { [I in keyof O]: O[I]['resultExamples'] },
      ),
    ),
  } as any);
