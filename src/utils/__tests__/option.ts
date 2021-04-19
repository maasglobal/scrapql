import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { None, none, Option, Some, some } from 'fp-ts/lib/Option';
import * as ruins from 'ruins-ts';

import { isAllNone, isAllSome, mergeOption } from '../option';

describe('option', () => {
  describe('isAllNone', () => {
    it('should work', () => {
      expect(isAllNone([none])).toStrictEqual(true);
      expect(isAllNone([none, none])).toStrictEqual(true);
      expect(isAllNone([some(1)])).toStrictEqual(false);
      expect(isAllNone([some(1), none])).toStrictEqual(false);
      expect(isAllNone([none, some(1)])).toStrictEqual(false);
      expect(isAllNone([none, some(1), none])).toStrictEqual(false);
      expect(isAllNone([some(1), none, some(2)])).toStrictEqual(false);
    });
    it('should be guard', () => {
      const test: NonEmptyArray<Option<number>> = [none];
      // @ts-expect-error Array test might contain Some<number>
      const fail: Array<None> = test;
      if (isAllNone(test)) {
        const success: Array<None> = test;
        expect(success).toStrictEqual(fail);
      }
    });
  });
  describe('isAllSome', () => {
    it('should work', () => {
      expect(isAllSome([some(1)])).toStrictEqual(true);
      expect(isAllSome([some(1), some(2)])).toStrictEqual(true);
      expect(isAllSome([none])).toStrictEqual(false);
      expect(isAllSome([none, some(1)])).toStrictEqual(false);
      expect(isAllSome([some(1), none])).toStrictEqual(false);
      expect(isAllSome([some(1), none, some(2)])).toStrictEqual(false);
      expect(isAllSome([none, some(1), none])).toStrictEqual(false);
    });
    it('should be guard', () => {
      const test: NonEmptyArray<Option<number>> = [some(1)];
      // @ts-expect-error Array test might contain None
      const fail: Array<Some<number>> = test;
      if (isAllSome(test)) {
        const success: Array<Some<number>> = test;
        expect(success).toStrictEqual(fail);
      }
    });
  });
  describe('mergeOption', () => {
    it('should work', () => {
      expect(mergeOption([none])).toStrictEqual(some([none]));
      expect(mergeOption([none, none])).toStrictEqual(some([none, none]));
      expect(mergeOption([some(1)])).toStrictEqual(some([some(1)]));
      expect(mergeOption([some(1), some(2)])).toStrictEqual(some([some(1), some(2)]));
      expect(mergeOption([some(1), none])).toStrictEqual(none);
      expect(mergeOption([none, some(1)])).toStrictEqual(none);
      expect(mergeOption([none, some(1), none])).toStrictEqual(none);
      expect(mergeOption([some(1), none, some(2)])).toStrictEqual(none);
    });
    it('should be guard', () => {
      const test: NonEmptyArray<Option<number>> = [some(1)];
      const merged = ruins.fromOption(mergeOption(test));
      if (merged === null) {
        throw new Error('assert false');
      }

      // @ts-expect-error Array test might contain mixed values
      const fail: Array<None> | Array<Some<number>> = test;
      expect(fail).toStrictEqual(test);

      const success: Array<None> | Array<Some<number>> = merged;
      expect(success).toStrictEqual(fail);
    });
  });
});
