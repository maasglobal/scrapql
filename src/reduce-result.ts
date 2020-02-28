import { Either, either } from 'fp-ts/lib/Either';
import { NonEmptyArray, nonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { Option, option } from 'fp-ts/lib/Option';
import * as Either_ from 'fp-ts/lib/Either';
import * as Array_ from 'fp-ts/lib/Array';
import * as Option_ from 'fp-ts/lib/Option';
import * as Record_ from 'fp-ts/lib/Record';
import { Lazy, flow } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';

import { Dict } from './dict';
import * as Dict_ from './dict';
import { mergeOption } from './option';

import {
  Result,
  LiteralResult,
  LeafResult,
  Key,
  KeysResult,
  Id,
  IdsResult,
  Terms,
  SearchResult,
  Property,
  PropertiesResult,
  Err,
  ResultReducer,
  LeafResultCombiner,
  ResultReducerMapping,
  ReduceFailure,
  reduceeMismatch,
} from './scrapql';

export const literal = <L extends LiteralResult>(
  results: NonEmptyArray<L>,
): Either<ReduceFailure, L> =>
  pipe(
    NonEmptyArray_.tail(results),
    Array_.reduce(
      Either_.right(NonEmptyArray_.head(results)),
      (ma: Either<ReduceFailure, L>, b: L): Either<ReduceFailure, L> =>
        pipe(
          ma,
          Either_.chain((a) => {
            if (JSON.stringify(a) !== JSON.stringify(b)) {
              return Either_.left(reduceeMismatch);
            }
            return Either_.right(a);
          }),
        ),
    ),
  );

export const leaf = <R extends LeafResult>(combineLeafResult: LeafResultCombiner<R>) => (
  results: NonEmptyArray<R>,
): Either<ReduceFailure, R> => {
  const writeResult: R = NonEmptyArray_.head(results);
  const readResult: Array<R> = NonEmptyArray_.tail(results);
  return pipe(readResult, Array_.reduce(writeResult, combineLeafResult), Either_.right);
};

export const keys = <K extends Key, SR extends Result>(
  reduceSubResult: ResultReducer<SR>,
) => (
  results: NonEmptyArray<KeysResult<SR, K>>,
): Either<ReduceFailure, KeysResult<SR, K>> =>
  pipe(
    results,
    Dict_.mergeSymmetric(
      (subResultVariants: NonEmptyArray<SR>): Option<Either<ReduceFailure, SR>> =>
        pipe(reduceSubResult(subResultVariants), Option_.some),
    ),
    Either_.fromOption(() => reduceeMismatch),
    Either_.chain(Dict_.sequenceEither),
  );

export const ids = <I extends Id, E extends Err, SR extends Result>(
  reduceSubResult: ResultReducer<SR>,
  existenceChange: Lazy<E>,
) => (
  results: NonEmptyArray<IdsResult<SR, I, E>>,
): Either<ReduceFailure, IdsResult<SR, I, E>> =>
  pipe(
    results,
    Dict_.mergeSymmetric(
      (
        subResultVariants: NonEmptyArray<Either<E, Option<SR>>>,
      ): Option<Either<ReduceFailure, Either<E, Option<SR>>>> =>
        pipe(
          subResultVariants,
          nonEmptyArray.sequence(either),
          Either_.map(mergeOption),
          Either_.chain(Either_.fromOption(existenceChange)),
          Either_.map(
            flow(
              nonEmptyArray.sequence(option),
              Option_.map((subResultVariants) => reduceSubResult(subResultVariants)),
              option.sequence(either),
            ),
          ),
          either.sequence(either),
          Option_.some,
        ),
    ),
    Either_.fromOption(() => reduceeMismatch),
    Either_.chain(Dict_.sequenceEither),
  );

export const search = <T extends Terms, I extends Id, E extends Err, SR extends Result>(
  reduceSubResult: ResultReducer<SR>,
  matchChange: (e: NonEmptyArray<Array<I>>) => E,
) => (
  results: NonEmptyArray<SearchResult<SR, T, I, E>>,
): Either<ReduceFailure, SearchResult<SR, T, I, E>> =>
  pipe(
    results,
    Dict_.mergeSymmetric((subResultVariants: NonEmptyArray<Either<E, Dict<I, SR>>>) =>
      pipe(
        subResultVariants,
        nonEmptyArray.sequence(either),
        Either_.chain((subResultDicts) =>
          pipe(
            subResultDicts,
            Dict_.mergeSymmetric(flow(reduceSubResult, Option_.some)),
            Either_.fromOption(
              (): E => pipe(subResultDicts, NonEmptyArray_.map(Dict_.keys), matchChange),
            ),
            Either_.map(Dict_.sequenceEither),
          ),
        ),
        either.sequence(either),
        Option_.some,
      ),
    ),
    Either_.fromOption(() => reduceeMismatch),
    Either_.chain(Dict_.sequenceEither),
  );

export const properties = <R extends PropertiesResult>(
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
