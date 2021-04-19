import * as Array_ from 'fp-ts/lib/Array';
import { pipe } from 'fp-ts/lib/function';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { None, Option, Some } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';

export const isAllNone = <T>(
  options: NonEmptyArray<Option<T>>,
): options is NonEmptyArray<None> =>
  pipe(options, Array_.filter(Option_.isSome), NonEmptyArray_.fromArray, Option_.isNone);

export const isAllSome = <T>(
  options: NonEmptyArray<Option<T>>,
): options is NonEmptyArray<Some<T>> =>
  pipe(options, Array_.filter(Option_.isNone), NonEmptyArray_.fromArray, Option_.isNone);

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
