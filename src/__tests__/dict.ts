import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { Either } from 'fp-ts/lib/Either';
import * as Either_ from 'fp-ts/lib/Either';
import * as Option_ from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';

import * as Dict_ from '../dict';
import { Dict, rewireDict } from '../dict';

describe('Dict', () => {
  it('reduceDuplicateKeys helper', () => {
    expect(rewireDict.reduceDuplicateKeys(['a', 'a', 'a'])).toMatchObject(
      Option_.some('a'),
    );

    expect(rewireDict.reduceDuplicateKeys(['a', 'b', 'c'])).toMatchObject(Option_.none);
  });

  it('transpose helper', () => {
    expect(
      pipe(NonEmptyArray_.cons([1, 2, 3], [[4, 5, 6]]), rewireDict.transpose),
    ).toMatchObject([
      NonEmptyArray_.cons(1, [4]),
      NonEmptyArray_.cons(2, [5]),
      NonEmptyArray_.cons(3, [6]),
    ]);
  });

  it('mergeSymmetric', () => {
    type Example = Dict<string, number>;
    const example1: Example = Dict_.dict(['foo', 1], ['bar', 2]);
    const example2: Example = Dict_.dict(['foo', 3], ['bar', 4]);

    const result: Either<'error', Example> = pipe(
      NonEmptyArray_.cons(example1, [example2]),
      Dict_.mergeSymmetric(
        () => 'error' as 'error',
        (valuevariants: NonEmptyArray<number>): Either<'error', number> =>
          pipe(
            valuevariants.reduce((a, b) => a + b),
            Either_.right,
          ),
      ),
    );
    expect(result).toMatchObject(Either_.right(Dict_.dict(['foo', 4], ['bar', 6])));
  });
});
