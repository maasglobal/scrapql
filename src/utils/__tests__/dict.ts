import * as Array_ from 'fp-ts/lib/Array';
import { Either } from 'fp-ts/lib/Either';
import * as Either_ from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as Option_ from 'fp-ts/lib/Option';
import * as string_ from 'fp-ts/lib/string';
import { Task } from 'fp-ts/lib/Task';
import * as Task_ from 'fp-ts/lib/Task';
import * as t from 'io-ts';

import * as Dict_ from '../dict';
import { Dict, rewireDict } from '../dict';

describe('Dict', () => {
  describe('Dict codec', () => {
    it('should support input validation', () => {
      const raw: unknown = [['foo', 123]];
      const result: Either<t.Errors, Dict<string, number>> = Dict(
        t.string,
        t.number,
      ).decode(raw);
      expect(result).toStrictEqual(Either_.right(raw));
    });
  });
  describe('values helper', () => {
    it('should extract values', () => {
      const result = Dict_.values([
        ['foo', 123],
        ['bar', 456],
      ]);
      expect(result).toMatchObject([123, 456]);
    });
  });
  describe('reduceDuplicateKeys helper', () => {
    it('should accept duplicates', () => {
      expect(
        pipe(['a', 'a', 'a'], rewireDict.reduceDuplicateKeys(string_.Eq)),
      ).toMatchObject(Option_.some('a'));
    });

    it('should reject non-duplicates', () => {
      expect(
        pipe(['a', 'b', 'c'], rewireDict.reduceDuplicateKeys(string_.Eq)),
      ).toMatchObject(Option_.none);
    });
  });

  describe('transpose helper', () => {
    it('should transpose dict', () => {
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
        ['a', [1, 4]],
        ['b', [2, 5]],
        ['c', [3, 6]],
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
        ['a', [1, 4]],
        ['b', [2, 5]],
        ['c', [3, 6]],
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
        ['a', [1, 4]],
        ['b', [5]],
        ['c', [3, 6]],
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
        ['a', [1, 4]],
        ['c', [3, 6]],
      ]);
    });
  });

  describe('mergeSymmetric', () => {
    it('should merge symmetric inputs', () => {
      type Example = Dict<string, number>;
      const example1: Example = Dict_.dict(['foo', 1], ['bar', 2]);
      const example2: Example = Dict_.dict(['foo', 3], ['bar', 4]);

      const result: Either<'error', Example> = pipe(
        [example2],
        Array_.prepend(example1),
        Dict_.mergeSymmetric(
          string_.Eq,
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
        [example2],
        Array_.prepend(example1),
        Dict_.mergeSymmetric(
          string_.Eq,
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
        [example2],
        Array_.prepend(example1),
        Dict_.mergeSymmetric(
          string_.Eq,
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
        [example2],
        Array_.prepend(example1),
        Dict_.mergeSymmetric(
          string_.Eq,
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

  describe('mergeAsymmetric', () => {
    it('should merge dicts', () => {
      type Example = Dict<string, number>;
      const example1: Example = Dict_.dict(['foo', 1], ['bar', 2], ['del', 5]);
      const example2: Example = Dict_.dict(['bar', 4], ['foo', 3], ['add', 8]);

      const result: Either<'error', Example> = pipe(
        [example2],
        Array_.prepend(example1),
        Dict_.mergeAsymmetric(
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
  describe('sequenceKVTask', () => {
    it('should make key part of the task that calculates value', async () => {
      const input: [string, Task<number>] = ['foo', Task_.of(123)];
      const result: Task<[string, number]> = Dict_.sequenceKVTask(input);
      const output: [string, number] = await result();
      const expected: [string, number] = ['foo', 123];
      expect(output).toStrictEqual(expected);
    });
  });
  describe('sequenceTask', () => {
    it('should combine Tasks from Dict values', async () => {
      const input: Dict<string, Task<number>> = Dict_.dict(['foo', Task_.of(123)]);
      const result: Task<Dict<string, number>> = Dict_.sequenceTask(input);
      const output: Dict<string, number> = await result();
      const expected: Dict<string, number> = Dict_.dict(['foo', 123]);
      expect(output).toStrictEqual(expected);
    });
  });
  describe('sequenceEither', () => {
    it('should combine Eithers from Dict values', async () => {
      type Failure = string;
      const input: Dict<string, Either<Failure, number>> = Dict_.dict([
        'foo',
        Either_.right(123),
      ]);
      const result: Either<Failure, Dict<string, number>> = Dict_.sequenceEither(input);
      const expected: Either<Failure, Dict<string, number>> = Either_.right(
        Dict_.dict(['foo', 123]),
      );
      expect(result).toStrictEqual(expected);
    });
  });
});
