import { eqString } from 'fp-ts/lib/Eq';
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
    expect(pipe(['a', 'a', 'a'], rewireDict.reduceDuplicateKeys(eqString))).toMatchObject(
      Option_.some('a'),
    );

    expect(pipe(['a', 'b', 'c'], rewireDict.reduceDuplicateKeys(eqString))).toMatchObject(
      Option_.none,
    );
  });

  it('transpose helper', () => {
    expect(
      rewireDict.transpose([
        [1, 2, 3],
        [4, 5, 6, 7],
      ]),
    ).toMatchObject([[1, 4], [2, 5], [3, 6], [7]]);
    expect(rewireDict.transpose([[]])).toMatchObject([]);
    expect(rewireDict.transpose([[1]])).toMatchObject([[1]]);
    expect(rewireDict.transpose([[1, 2, 3]])).toMatchObject([[1], [2], [3]]);
    expect(rewireDict.transpose([[1], [2], [3]])).toMatchObject([[1, 2, 3]]);
    expect(rewireDict.transpose([[], []])).toMatchObject([]);
    expect(rewireDict.transpose([[1], []])).toMatchObject([[1]]);
    expect(rewireDict.transpose([[], [1]])).toMatchObject([[1]]);
    expect(rewireDict.transpose([[1], [2]])).toMatchObject([[1, 2]]);
    expect(rewireDict.transpose([[1], [2, 3]])).toMatchObject([[1, 2], [3]]);
    expect(rewireDict.transpose([[1, 2], [3]])).toMatchObject([[1, 3], [2]]);
    expect(
      rewireDict.transpose([
        [1, 2],
        [3, 4],
      ]),
    ).toMatchObject([
      [1, 3],
      [2, 4],
    ]);
    expect(rewireDict.transpose([[1, 2, 3], [4]])).toMatchObject([[1, 4], [2], [3]]);
    expect(rewireDict.transpose([[1], [2, 3, 4]])).toMatchObject([[1, 2], [3], [4]]);
    expect(rewireDict.transpose([[1], [2, 3], [4, 5, 6]])).toMatchObject([
      [1, 2, 4],
      [3, 5],
      [6],
    ]);
    expect(rewireDict.transpose([[1, 2, 3], [4, 5], [6]])).toMatchObject([
      [1, 4, 6],
      [2, 5],
      [3],
    ]);
    expect(rewireDict.transpose([[1, 2], [3], [4, 5, 6]])).toMatchObject([
      [1, 3, 4],
      [2, 5],
      [6],
    ]);
    expect(rewireDict.transpose([[1, 2, 3], [4], [5, 6]])).toMatchObject([
      [1, 4, 5],
      [2, 6],
      [3],
    ]);
  });

  describe('sortAndTranspose helper', () => {
    it('should work on sorted input', () => {
      expect(
        rewireDict
          .sortAndTranspose([
            [
              ['a', 1],
              ['b', 2],
              ['c', 3],
            ],
            [
              ['a', 4],
              ['b', 5],
              ['c', 6],
            ],
          ])
          .sort(),
      ).toMatchObject([
        [
          ['a', 1],
          ['a', 4],
        ],
        [
          ['b', 2],
          ['b', 5],
        ],
        [
          ['c', 3],
          ['c', 6],
        ],
      ]);
    });

    it('should work on unsorted input', () => {
      expect(
        rewireDict
          .sortAndTranspose([
            [
              ['a', 1],
              ['c', 3],
              ['b', 2],
            ],
            [
              ['b', 5],
              ['c', 6],
              ['a', 4],
            ],
          ])
          .sort(),
      ).toMatchObject([
        [
          ['a', 1],
          ['a', 4],
        ],
        [
          ['b', 2],
          ['b', 5],
        ],
        [
          ['c', 3],
          ['c', 6],
        ],
      ]);
    });

    it('should support addition', () => {
      expect(
        rewireDict
          .sortAndTranspose([
            [
              ['a', 1],
              ['c', 3],
            ],
            [
              ['a', 4],
              ['b', 5],
              ['c', 6],
            ],
          ])
          .sort(),
      ).toMatchObject([
        [
          ['a', 1],
          ['a', 4],
        ],
        [['b', 5]],
        [
          ['c', 3],
          ['c', 6],
        ],
      ]);
    });

    it('should support substraction', () => {
      expect(
        rewireDict
          .sortAndTranspose([
            [
              ['a', 1],
              ['b', 2],
              ['c', 3],
            ],
            [
              ['a', 4],
              ['c', 6],
            ],
          ])
          .sort(),
      ).toMatchObject([
        [
          ['a', 1],
          ['a', 4],
        ],
        [
          ['c', 3],
          ['c', 6],
        ],
      ]);
    });
  });

  describe('mergeSymmetric', () => {
    it('should merge symmetric inputs', () => {
      type Example = Dict<string, number>;
      const example1: Example = Dict_.dict(['foo', 1], ['bar', 2]);
      const example2: Example = Dict_.dict(['foo', 3], ['bar', 4]);

      const result: Either<'error', Example> = pipe(
        NonEmptyArray_.cons(example1, [example2]),
        Dict_.mergeSymmetric(
          eqString,
          () => 'error' as const,
          (valuevariants: NonEmptyArray<number>): Either<'error', number> =>
            pipe(
              valuevariants.reduce((a, b) => a + b),
              Either_.right,
            ),
        ),
      );
      expect(result).toMatchObject(Either_.right(Dict_.dict(['foo', 4], ['bar', 6])));
    });

    it('should reject extra long first input', () => {
      type Example = Dict<string, number>;
      const example1: Example = Dict_.dict(['foo', 1], ['bar', 2], ['quux', 5]);
      const example2: Example = Dict_.dict(['foo', 3], ['bar', 4]);

      const result: Either<'error', Example> = pipe(
        NonEmptyArray_.cons(example1, [example2]),
        Dict_.mergeSymmetric(
          eqString,
          () => 'error' as const,
          (valuevariants: NonEmptyArray<number>): Either<'error', number> =>
            pipe(
              valuevariants.reduce((a, b) => a + b),
              Either_.right,
            ),
        ),
      );
      expect(result).toMatchObject(Either_.left('error'));
    });
    it('should reject extra long second input', () => {
      type Example = Dict<string, number>;
      const example1: Example = Dict_.dict(['foo', 1], ['bar', 2]);
      const example2: Example = Dict_.dict(['foo', 3], ['bar', 4], ['quux', 5]);

      const result: Either<'error', Example> = pipe(
        NonEmptyArray_.cons(example1, [example2]),
        Dict_.mergeSymmetric(
          eqString,
          () => 'error' as const,
          (valuevariants: NonEmptyArray<number>): Either<'error', number> =>
            pipe(
              valuevariants.reduce((a, b) => a + b),
              Either_.right,
            ),
        ),
      );
      expect(result).toMatchObject(Either_.left('error'));
    });
    it('should reject non-symmetric inputs', () => {
      type Example = Dict<string, number>;
      const example1: Example = Dict_.dict(['foo', 1], ['bar', 2]);
      const example2: Example = Dict_.dict(['bar', 4], ['foo', 3]);

      const result: Either<'error', Example> = pipe(
        NonEmptyArray_.cons(example1, [example2]),
        Dict_.mergeSymmetric(
          eqString,
          () => 'error' as const,
          (valuevariants: NonEmptyArray<number>): Either<'error', number> =>
            pipe(
              valuevariants.reduce((a, b) => a + b),
              Either_.right,
            ),
        ),
      );
      expect(result).toMatchObject(Either_.left('error'));
    });
  });

  it('mergeAsymmetric', () => {
    type Example = Dict<string, number>;
    const example1: Example = Dict_.dict(['foo', 1], ['bar', 2], ['del', 5]);
    const example2: Example = Dict_.dict(['bar', 4], ['foo', 3], ['add', 8]);

    const result: Either<'error', Example> = pipe(
      NonEmptyArray_.cons(example1, [example2]),
      Dict_.mergeAsymmetric(
        () => 'error' as const,
        (valuevariants: NonEmptyArray<number>): Either<'error', number> =>
          pipe(
            valuevariants.reduce((a, b) => a + b),
            Either_.right,
          ),
      ),
    );
    expect(result).toMatchObject(
      Either_.right(Dict_.dict(['foo', 4], ['bar', 6], ['add', 8])),
    );
  });
});
