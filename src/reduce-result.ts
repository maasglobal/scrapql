import { Either, either } from 'fp-ts/lib/Either';
import { NonEmptyArray, nonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { Option, None, Some, option } from 'fp-ts/lib/Option';
import * as Either_ from 'fp-ts/lib/Either';
import * as Array_ from 'fp-ts/lib/Array';
import * as Option_ from 'fp-ts/lib/Option';
import * as Record_ from 'fp-ts/lib/Record';
import { Lazy } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';

import {
  Result,
  LiteralResult,
  LeafResult,
  Key,
  KeysResult,
  Id,
  IdsResult,
  Property,
  PropertiesResult,
  Err,
  Results,
  ResultReducer,
  LeafResultCombiner,
  ResultReducerMapping,
} from './scrapql';

export const literal = <L extends LiteralResult>(results: Results<L>): L =>
  pipe(
    NonEmptyArray_.tail(results),
    Array_.reduce(
      NonEmptyArray_.head(results),
      (a: L, b: L): L => {
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          // eslint-disable-next-line
          throw new Error('result literal mismatch');
        }
        return a;
      },
    ),
  );

export const leaf = <R extends LeafResult>(combineLeafResult: LeafResultCombiner<R>) => (
  results: Results<R>,
): R => {
  const writeResult: R = NonEmptyArray_.head(results);
  const readResult: Array<R> = NonEmptyArray_.tail(results);

  return pipe(
    readResult,
    Array_.reduce(writeResult, combineLeafResult),
  );
};

export const keys = <K extends Key, SR extends Result>(
  reduceSubResults: ResultReducer<SR>,
) => (results: Results<KeysResult<SR, K>>): KeysResult<SR, K> =>
  pipe(
    NonEmptyArray_.head(results),
    Record_.mapWithIndex((key: K) => {
      const subResults = pipe(
        results,
        NonEmptyArray_.map((r) => r[key]),
      );
      return reduceSubResults(subResults);
    }),
  );

const isAllNone = <T>(
  options: NonEmptyArray<Option<T>>,
): options is NonEmptyArray<None> =>
  pipe(
    options,
    NonEmptyArray_.filter(Option_.isSome),
    Option_.isNone,
  );

const isAllSome = <T>(
  options: NonEmptyArray<Option<T>>,
): options is NonEmptyArray<None> =>
  pipe(
    options,
    NonEmptyArray_.filter(Option_.isNone),
    Option_.isNone,
  );

export const ids = <K extends Id, E extends Err, SR extends Result>(
  reduceSubResults: ResultReducer<SR>,
  existenceChange: Lazy<E>,
) => (results: Results<IdsResult<SR, K, E>>): IdsResult<SR, K, E> =>
  pipe(
    NonEmptyArray_.head(results),
    Record_.mapWithIndex(
      (key: K): Either<E, Option<SR>> => {
        return pipe(
          results,
          NonEmptyArray_.map((r) => r[key]),
          nonEmptyArray.sequence(either),
          Either_.chain(
            (
              optionalResults: Results<Option<SR>>,
            ): Either<E, Results<None> | Results<Some<SR>>> => {
              if (isAllNone(optionalResults)) {
                return Either_.right(optionalResults);
              }
              if (isAllSome(optionalResults)) {
                return Either_.right(optionalResults);
              }
              return Either_.left(existenceChange());
            },
          ),
          Either_.map(nonEmptyArray.sequence(option)),
          Either_.map(
            Option_.map(
              (subResults: Results<SR>): SR => {
                return reduceSubResults(subResults);
              },
            ),
          ),
        );
      },
    ),
  );

export const properties = <R extends PropertiesResult>(
  processors: ResultReducerMapping<R>,
) => <P extends Property & keyof R>(results: Results<R>): R =>
  pipe(
    NonEmptyArray_.head(results),
    Record_.mapWithIndex<P, unknown, R[P]>((propName) => {
      const propReducer = processors[propName];
      return pipe(
        results,
        NonEmptyArray_.map((r) => r[propName]),
        propReducer,
      );
    }),
  ) as R;
