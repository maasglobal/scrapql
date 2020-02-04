import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { Option, None, Some } from 'fp-ts/lib/Option';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import * as Option_ from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';

export const isAllNone = <T>(
  options: NonEmptyArray<Option<T>>,
): options is NonEmptyArray<None> =>
  pipe(
    options,
    NonEmptyArray_.filter(Option_.isSome),
    Option_.isNone,
  );

export const isAllSome = <T>(
  options: NonEmptyArray<Option<T>>,
): options is NonEmptyArray<None> =>
  pipe(
    options,
    NonEmptyArray_.filter(Option_.isNone),
    Option_.isNone,
  );

//: Either<E, NonEmptyArray<None> | NonEmptyArray<Some<SR>>>

export const mergeOption = <V>(
  variations: NonEmptyArray<Option<V>>,
): Option<NonEmptyArray<None> | NonEmptyArray<Some<V>>> => {
  if (isAllNone(variations)) {
    return Option_.some(variations);
  }
  if (isAllSome(variations)) {
    return Option_.some(variations);
  }
  return Option_.none;
};
