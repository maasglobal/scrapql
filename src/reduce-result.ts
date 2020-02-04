import { Either, either } from 'fp-ts/lib/Either';
import { NonEmptyArray, nonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { Option, None, Some, option } from 'fp-ts/lib/Option';
import * as Either_ from 'fp-ts/lib/Either';
import * as Array_ from 'fp-ts/lib/Array';
import * as Option_ from 'fp-ts/lib/Option';
import * as Record_ from 'fp-ts/lib/Record';
import { sequenceS } from 'fp-ts/lib/Apply';
import { Lazy } from 'fp-ts/lib/function';
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

export const literal = <L extends LiteralResult<any>>(
  results: NonEmptyArray<L>,
): Either<ReduceFailure, L> =>
  pipe(
    NonEmptyArray_.tail(results),
    Array_.reduce(
      Either_.right(NonEmptyArray_.head(results)),
      (
        ma: Either<ReduceFailure, L>,
        mb: Either<ReduceFailure, L>,
      ): Either<ReduceFailure, L> =>
        pipe(
          { a: ma, b: mb },
          sequenceS(either),
          Either_.chain(({ a, b }) => {
            if (JSON.stringify(a) !== JSON.stringify(b)) {
              return Either_.left(reduceeMismatch);
            }
            return Either_.right(a);
          }),
        ),
    ),
  );

export const leaf = <R extends LeafResult<any>>(
  combineLeafResult: LeafResultCombiner<R>,
) => (results: NonEmptyArray<R>): Either<ReduceFailure, R> => {
  const writeResult: R = NonEmptyArray_.head(results);
  const readResult: Array<R> = NonEmptyArray_.tail(results);

  const foob = pipe(
    readResult,
    Array_.reduce(writeResult, combineLeafResult),
  );
  return foob;
};

export const keys = <K extends Key<any>, SR extends Result<any>>(
  reduceSubResult: ResultReducer<SR>,
) => (
  results: NonEmptyArray<KeysResult<SR, K>>,
): Either<ReduceFailure, KeysResult<SR, K>> =>
  pipe(
    results,
    Dict_.mergeSymmetric(
      (subResultVariants: NonEmptyArray<SR>): Option<Either<ReduceFailure, SR>> =>
        pipe(
          reduceSubResult(subResultVariants),
          Option_.some,
        ),
    ),
    Either_.fromOption(() => reduceeMismatch),
    Either_.chain(Dict_.sequenceEither),
  );

export const ids = <I extends Id<any>, E extends Err<any>, SR extends Result<any>>(
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
          (x: NonEmptyArray<Either<E, Option<SR>>>) => x,
          nonEmptyArray.sequence(either),
          (x: Either<E, NonEmptyArray<Option<SR>>>) => x,
          Either_.map((foobb) =>
            pipe(
              foobb,
              (x: NonEmptyArray<Option<SR>>) => x,
              mergeOption,
              (x: Option<NonEmptyArray<None> | NonEmptyArray<Some<SR>>>) => x,
            ),
          ),
          (x: Either<E, Option<NonEmptyArray<None> | NonEmptyArray<Some<SR>>>>) => x,
          Either_.chain(Either_.fromOption(existenceChange)),
          (x: Either<E, NonEmptyArray<None> | NonEmptyArray<Some<SR>>>) => x,
          Either_.map(nonEmptyArray.sequence(option)),
          (x: Either<E, Option<NonEmptyArray<SR>>>) => x,
          Either_.map(
            Option_.map(
              (subResultVariants: NonEmptyArray<SR>): Either<ReduceFailure, SR> =>
                reduceSubResult(subResultVariants),
            ),
          ),
          Option_.some,
          (x: Option<Either<ReduceFailure, Either<E, Option<SR>>>>) => x,
        ),
    ),
    (x: Option<Dict<I, Either<ReduceFailure, Either<E, Option<SR>>>>>) => x,
    Either_.fromOption(() => reduceeMismatch),
    Either_.chain(Dict_.sequenceEither),
    (x: Either<ReduceFailure, Dict<I, Either<E, Option<SR>>>>) => x,
  );

export const search = <
  T extends Terms<any>,
  I extends Id<any>,
  E extends Err<any>,
  SR extends Result<any>
>(
  reduceSubResult: ResultReducer<SR>,
  matchChange: Lazy<E>,
) => (
  results: NonEmptyArray<SearchResult<SR, T, I, E>>,
): Either<ReduceFailure, SearchResult<SR, T, I, E>> =>
  pipe(
    results,
    Dict_.mergeSymmetric(
      (
        subResultVariants: NonEmptyArray<Either<E, Dict<I, SR>>>,
      ): Option<Either<E, Dict<I, SR>>> =>
        pipe(
          subResultVariants,
          nonEmptyArray.sequence(either),
          Either_.chain(
            (optionalResults: NonEmptyArray<Dict<I, SR>>): Either<E, Dict<I, SR>> =>
              pipe(
                optionalResults,
                Dict_.mergeSymmetric(reduceSubResult),
                Either_.fromOption(matchChange),
              ),
          ),
          Option_.some,
        ),
    ),
    Option_.getOrElse(
      (): Dict<T, Either<E, Dict<I, SR>>> => {
        // eslint-disable-next-line fp/no-throw
        throw new Error('reduce error, search results are not symmetric');
      },
    ),
  );

export const properties = <R extends PropertiesResult<any>>(
  processors: ResultReducerMapping<R>,
) => <P extends Property & keyof R>(results: NonEmptyArray<R>): R =>
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
